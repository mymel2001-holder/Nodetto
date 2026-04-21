import * as db from './db';
import * as crypt from './crypt';
import { v4 as uuidv4 } from 'uuid';

export interface NoteMetadata {
    id: string;
    title: string;
    parent_id: string | null;
    is_folder: boolean;
    folder_open: boolean;
    updated_at: number;
    deleted: boolean;
}

export interface NoteResponse {
    id: string;
    title: string;
    parent_id: string | null;
    is_folder: boolean;
    folder_open: boolean;
    content: string;
    updated_at: number;
    deleted: boolean;
}

export async function createNote(title: string, parent_id: string | null = null): Promise<string> {
    const workspace = await db.getLoggedWorkspace();
    if (!workspace) throw new Error("No workspace is loaded");

    const uuid = uuidv4();
    const metadata: crypt.NoteMetadata = {
        title,
        parent_id,
        is_folder: false,
        folder_open: false
    };

    const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
    const { ciphertext: mCipher, nonce: mNonce } = await crypt.encryptData(metadataBytes, workspace.master_encryption_key);
    
    const { ciphertext: cCipher, nonce: cNonce } = await crypt.encryptData(new Uint8Array(), workspace.master_encryption_key);

    const note: db.Note = {
        uuid,
        id_workspace: workspace.id!,
        content: cCipher,
        nonce: cNonce,
        metadata: mCipher,
        metadata_nonce: mNonce,
        updated_at: Math.floor(Date.now() / 1000),
        synched: false,
        deleted: false
    };

    await db.db.notes.add(note);
    return uuid;
}

export async function createFolder(title: string, parent_id: string | null = null): Promise<string> {
    const workspace = await db.getLoggedWorkspace();
    if (!workspace) throw new Error("No workspace is loaded");

    const uuid = uuidv4();
    const metadata: crypt.NoteMetadata = {
        title,
        parent_id,
        is_folder: true,
        folder_open: true
    };

    const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
    const { ciphertext: mCipher, nonce: mNonce } = await crypt.encryptData(metadataBytes, workspace.master_encryption_key);
    
    const { ciphertext: cCipher, nonce: cNonce } = await crypt.encryptData(new Uint8Array(), workspace.master_encryption_key);

    const note: db.Note = {
        uuid,
        id_workspace: workspace.id!,
        content: cCipher,
        nonce: cNonce,
        metadata: mCipher,
        metadata_nonce: mNonce,
        updated_at: Math.floor(Date.now() / 1000),
        synched: false,
        deleted: false
    };

    await db.db.notes.add(note);
    return uuid;
}

export async function getNote(id: string): Promise<NoteResponse> {
    const workspace = await db.getLoggedWorkspace();
    if (!workspace) throw new Error("No workspace is loaded");

    const note = await db.db.notes.get(id);
    if (!note) throw new Error("Note not found");

    const contentPlain = await crypt.decryptData(note.content, note.nonce, workspace.master_encryption_key);
    const metadataPlain = await crypt.decryptData(note.metadata, note.metadata_nonce, workspace.master_encryption_key);
    const metadata: crypt.NoteMetadata = JSON.parse(new TextDecoder().decode(metadataPlain));

    // Update latest note
    workspace.latest_note_id = id;
    await db.updateWorkspace(workspace);

    return {
        id: note.uuid,
        title: metadata.title,
        parent_id: metadata.parent_id,
        is_folder: metadata.is_folder,
        folder_open: metadata.folder_open,
        content: new TextDecoder().decode(contentPlain),
        updated_at: note.updated_at * 1000,
        deleted: note.deleted
    };
}

export async function editNote(noteData: NoteResponse): Promise<void> {
    const workspace = await db.getLoggedWorkspace();
    if (!workspace) throw new Error("No workspace is loaded");

    const metadata: crypt.NoteMetadata = {
        title: noteData.title,
        parent_id: noteData.parent_id,
        is_folder: noteData.is_folder,
        folder_open: noteData.folder_open
    };

    const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
    const { ciphertext: mCipher, nonce: mNonce } = await crypt.encryptData(metadataBytes, workspace.master_encryption_key);
    
    const contentBytes = new TextEncoder().encode(noteData.content);
    const { ciphertext: cCipher, nonce: cNonce } = await crypt.encryptData(contentBytes, workspace.master_encryption_key);

    await db.db.notes.update(noteData.id, {
        content: cCipher,
        nonce: cNonce,
        metadata: mCipher,
        metadata_nonce: mNonce,
        updated_at: Math.floor(Date.now() / 1000),
        synched: false,
        deleted: noteData.deleted
    });
}

export async function getAllNotesMetadata(id_workspace: number): Promise<NoteMetadata[]> {
    const workspace = await db.getLoggedWorkspace();
    if (!workspace) throw new Error("No workspace is loaded");

    const notes = await db.db.notes.where('id_workspace').equals(id_workspace).toArray();
    
    const results = await Promise.all(notes.map(async n => {
        const metadataPlain = await crypt.decryptData(n.metadata, n.metadata_nonce, workspace.master_encryption_key);
        const metadata: crypt.NoteMetadata = JSON.parse(new TextDecoder().decode(metadataPlain));
        return {
            id: n.uuid,
            title: metadata.title,
            parent_id: metadata.parent_id,
            is_folder: metadata.is_folder,
            folder_open: metadata.folder_open,
            updated_at: n.updated_at * 1000,
            deleted: n.deleted
        };
    }));

    return results;
}

export async function deleteNote(id: string): Promise<void> {
    const workspace = await db.getLoggedWorkspace();
    if (!workspace) throw new Error("No workspace is loaded");

    await db.db.notes.update(id, {
        deleted: true,
        synched: false,
        updated_at: Math.floor(Date.now() / 1000)
    });
}

export async function restoreNote(id: string): Promise<void> {
    const workspace = await db.getLoggedWorkspace();
    if (!workspace) throw new Error("No workspace is loaded");

    await db.db.notes.update(id, {
        deleted: false,
        synched: false,
        updated_at: Math.floor(Date.now() / 1000)
    });
}

export async function getLatestNoteId(): Promise<string | null> {
    const workspace = await db.getLoggedWorkspace();
    return workspace?.latest_note_id || null;
}

export async function createWorkspace(workspace_name: string) {
    const wsData = await crypt.createWorkspace();
    const ws = await db.createWorkspace(
        workspace_name,
        new Uint8Array(wsData.master_encryption_key),
        wsData.salt_recovery_data,
        new Uint8Array(wsData.mek_recovery_nonce),
        new Uint8Array(wsData.encrypted_mek_recovery)
    );
    await db.setLoggedWorkspace(workspace_name);
    return ws;
}

export async function getWorkspaces() {
    const workspaces = await db.getWorkspaces();
    return workspaces.map(ws => ({
        id: ws.id,
        workspace_name: ws.workspace_name
    }));
}

export async function setLoggedWorkspace(workspace_name: string) {
    await db.setLoggedWorkspace(workspace_name);
    const ws = await db.getLoggedWorkspace();
    return ws ? { id: ws.id, workspace_name: ws.workspace_name } : null;
}

export async function getLoggedWorkspace() {
    const ws = await db.getLoggedWorkspace();
    return ws ? { id: ws.id, workspace_name: ws.workspace_name } : null;
}

export async function syncCreateAccount(username: string, password: string, instance: string | null) {
    const workspace = await db.getLoggedWorkspace();
    if (!workspace) throw new Error("A workspace must be loaded before creating an account");

    const account = await crypt.createAccount(password, workspace.master_encryption_key);
    
    const payload = {
        ...account,
        username,
        mek_password_nonce: Array.from(account.mek_password_nonce),
        encrypted_mek_password: Array.from(account.encrypted_mek_password),
    };

    const resp = await fetch(`${instance}/create_account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
}

export async function syncLogin(username: string, password: string, instance: string | null) {
    const workspace = await db.getLoggedWorkspace();
    if (!workspace) throw new Error("A workspace must be loaded before logging in");

    if (!instance) throw new Error("Instance url is empty");

    // 1. Get salts
    const saltsResp = await fetch(`${instance}/login?username=${username}`);
    if (!saltsResp.ok) throw new Error(`Server returned ${saltsResp.status}`);
    const salts = await saltsResp.json();

    // 2. Login
    const loginHash = await crypt.login(salts, password);
    const loginResp = await fetch(`${instance}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, login_hash: loginHash })
    });

    if (!loginResp.ok) throw new Error(`Server returned ${loginResp.status}`);
    const loginData = await loginResp.json();

    // 3. Decrypt MEK
    const mek = await crypt.decryptMek(
        password,
        new Uint8Array(loginData.encrypted_mek_password),
        loginData.salt_data,
        new Uint8Array(loginData.mek_password_nonce)
    );

    // 4. Update local notes if they were encrypted with another key? 
    // In Rust version, it re-encrypts all local notes with the new MEK.
    // This is because the user might be logging in with an existing account to a fresh workspace.
    // Or switching accounts.
    const notes = await db.db.notes.where('id_workspace').equals(workspace.id!).toArray();
    for (const note of notes) {
        // We assume local notes were encrypted with the *old* workspace MEK.
        // We need to decrypt with old MEK and encrypt with new MEK.
        // But wait, if it's a fresh workspace, there are no notes.
        // If it's an existing workspace, the MEK should match.
        // Rust code does: `notes.into_iter().map(|n| db::operations::get_note(&conn, n.uuid, mek))`
        // This is a bit complex in JS because we need to handle the decryption failure if keys don't match.
        try {
            const contentPlain = await crypt.decryptData(note.content, note.nonce, workspace.master_encryption_key);
            const metadataPlain = await crypt.decryptData(note.metadata, note.metadata_nonce, workspace.master_encryption_key);
            
            const { ciphertext: cCipher, nonce: cNonce } = await crypt.encryptData(contentPlain, mek);
            const { ciphertext: mCipher, nonce: mNonce } = await crypt.encryptData(metadataPlain, mek);
            
            await db.db.notes.update(note.uuid, {
                content: cCipher,
                nonce: cNonce,
                metadata: mCipher,
                metadata_nonce: mNonce,
                synched: false // Mark as unsynced to push to new account
            });
        } catch (e) {
            console.warn("Failed to re-encrypt note, keys might be different:", note.uuid);
        }
    }

    // 5. Update workspace
    workspace.master_encryption_key = mek;
    workspace.token = new Uint8Array(loginData.token);
    workspace.instance = instance;
    workspace.username = username;
    await db.updateWorkspace(workspace);
}
