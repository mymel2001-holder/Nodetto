import * as db from './db';
import { Note, Workspace } from './db';
import * as crypt from './crypt';

export enum SyncStatus {
    Synched = "Synched",
    Syncing = "Syncing",
    Error = "Error",
    Offline = "Offline",
    NotConnected = "NotConnected",
}

export async function syncNotes(workspace: Workspace, setSyncStatus: (status: SyncStatus) => void, onConflict: (note: any) => void) {
    if (!workspace.token || !workspace.instance) {
        setSyncStatus(SyncStatus.NotConnected);
        return;
    }

    try {
        setSyncStatus(SyncStatus.Syncing);
        
        // 1. Receive latest notes
        const maxReceivedTs = await receiveLatestNotes(workspace, onConflict);
        if (maxReceivedTs !== null) {
            workspace.last_sync_at = maxReceivedTs + 1;
            await db.updateWorkspace(workspace);
        }

        // 2. Send latest notes
        const maxSentTs = await sendLatestNotes(workspace, onConflict);
        if (maxSentTs !== null) {
            workspace.last_sync_at = Math.max(workspace.last_sync_at, maxSentTs + 1);
            await db.updateWorkspace(workspace);
        }

        setSyncStatus(SyncStatus.Synched);
    } catch (e) {
        console.error("Sync error:", e);
        setSyncStatus(SyncStatus.Error);
    }
}

async function receiveLatestNotes(workspace: Workspace, onConflict: (note: any) => void): Promise<number | null> {
    const tokenHex = Array.from(workspace.token!).map(b => b.toString(16).padStart(2, '0')).join('');
    const resp = await fetch(`${workspace.instance}/notes?username=${workspace.username}&token=${tokenHex}&updated_at=${workspace.last_sync_at}`);
    
    if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
    
    const notes = await resp.json();
    if (notes.length === 0) return null;

    let maxTs = workspace.last_sync_at;

    for (const srvNote of notes) {
        maxTs = Math.max(maxTs, srvNote.updated_at);
        
        const existingNote = await db.db.notes.get(srvNote.uuid);
        const localNote: Note = {
            ...srvNote,
            id_workspace: workspace.id!,
            synched: true,
            // Convert arrays to Uint8Array if needed
            content: new Uint8Array(srvNote.content),
            nonce: new Uint8Array(srvNote.nonce),
            metadata: new Uint8Array(srvNote.metadata),
            metadata_nonce: new Uint8Array(srvNote.metadata_nonce),
        };

        if (existingNote) {
            if (srvNote.updated_at > existingNote.updated_at) {
                if (existingNote.synched) {
                    await db.db.notes.put(localNote);
                } else {
                    // Conflict
                    const decrypted = await decryptNoteForFrontend(localNote, workspace);
                    onConflict(decrypted);
                }
            }
        } else {
            await db.db.notes.add(localNote);
        }
    }

    return maxTs;
}

async function sendLatestNotes(workspace: Workspace, onConflict: (note: any) => void): Promise<number | null> {
    const unsyncedNotes = await db.db.notes.where('id_workspace').equals(workspace.id!).and((n: Note) => !n.synched).toArray();
    if (unsyncedNotes.length === 0) return null;

    const payload = {
        username: workspace.username,
        token: Array.from(workspace.token!),
        notes: unsyncedNotes.map((n: Note) => ({
            uuid: n.uuid,
            content: Array.from(n.content),
            nonce: Array.from(n.nonce),
            metadata: Array.from(n.metadata),
            metadata_nonce: Array.from(n.metadata_nonce),
            updated_at: n.updated_at,
            deleted: n.deleted
        })),
        force: false
    };

    const resp = await fetch(`${workspace.instance}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) throw new Error(`Server returned ${resp.status}`);

    const results = await resp.json();
    let maxTs = 0;

    for (const result of results) {
        if (result.status === 'Ok') {
            await db.db.notes.update(result.uuid, { synched: true });
            const n = await db.db.notes.get(result.uuid);
            if (n) maxTs = Math.max(maxTs, n.updated_at);
        } else if (result.status.Conflict) {
            const conflictedSrvNote = result.status.Conflict;
            const localNote: Note = {
                ...conflictedSrvNote,
                id_workspace: workspace.id!,
                synched: true,
                content: new Uint8Array(conflictedSrvNote.content),
                nonce: new Uint8Array(conflictedSrvNote.nonce),
                metadata: new Uint8Array(conflictedSrvNote.metadata),
                metadata_nonce: new Uint8Array(conflictedSrvNote.metadata_nonce),
            };
            const decrypted = await decryptNoteForFrontend(localNote, workspace);
            onConflict(decrypted);
        }
    }

    return maxTs > 0 ? maxTs : null;
}

async function decryptNoteForFrontend(note: Note, workspace: Workspace) {
    const contentPlain = await crypt.decryptData(note.content, note.nonce, workspace.master_encryption_key);
    const metadataPlain = await crypt.decryptData(note.metadata, note.metadata_nonce, workspace.master_encryption_key);
    const metadata = JSON.parse(new TextDecoder().decode(metadataPlain));

    return {
        id: note.uuid,
        title: metadata.title,
        parent_id: metadata.parent_id,
        is_folder: metadata.is_folder,
        folder_open: metadata.folder_open,
        content: new TextDecoder().decode(contentPlain),
        updated_at: note.updated_at,
        deleted: note.deleted
    };
}
