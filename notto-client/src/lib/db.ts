import Dexie, { type EntityTable } from 'dexie';

export interface Note {
    uuid: string;
    id_workspace: number;
    content: Uint8Array;
    nonce: Uint8Array;
    metadata: Uint8Array;
    metadata_nonce: Uint8Array;
    updated_at: number;
    synched: boolean;
    deleted: boolean;
}

export interface Workspace {
    id?: number;
    workspace_name: string;
    username: string | null;
    master_encryption_key: Uint8Array;
    salt_recovery_data: string;
    mek_recovery_nonce: Uint8Array;
    encrypted_mek_recovery: Uint8Array;
    token: Uint8Array | null;
    instance: string | null;
    last_sync_at: number;
    latest_note_id: string | null;
}

export interface Common {
    key: string;
    value: string;
}

class NottoDatabase extends Dexie {
    notes!: EntityTable<Note, 'uuid'>;
    workspaces!: EntityTable<Workspace, 'id'>;
    common!: EntityTable<Common, 'key'>;

    constructor() {
        super('NottoDatabase');
        this.version(1).stores({
            notes: 'uuid, id_workspace, updated_at, synched, deleted',
            workspaces: '++id, &workspace_name, username',
            common: 'key'
        });
    }
}

export const db = new NottoDatabase();

export async function initDb() {
    // Initial setup if needed
    const loggedWorkspaceName = await db.common.get('logged_workspace_name');
    if (!loggedWorkspaceName) {
        // No default setup here, App.tsx handles creation
    }
}

export async function getLoggedWorkspace(): Promise<Workspace | null> {
    const entry = await db.common.get('logged_workspace_name');
    if (!entry) return null;
    const ws = await db.workspaces.where('workspace_name').equals(entry.value).first();
    return ws || null;
}

export async function setLoggedWorkspace(workspaceName: string) {
    await db.common.put({ key: 'logged_workspace_name', value: workspaceName });
}

export async function getWorkspaces(): Promise<Workspace[]> {
    return await db.workspaces.toArray();
}

export async function createWorkspace(workspaceName: string, mek: Uint8Array, saltRecoveryData: string, mekRecoveryNonce: Uint8Array, encryptedMekRecovery: Uint8Array): Promise<Workspace> {
    const ws: Workspace = {
        workspace_name: workspaceName,
        username: null,
        master_encryption_key: mek,
        salt_recovery_data: saltRecoveryData,
        mek_recovery_nonce: mekRecoveryNonce,
        encrypted_mek_recovery: encryptedMekRecovery,
        token: null,
        instance: null,
        last_sync_at: 0,
        latest_note_id: null
    };
    const id = await db.workspaces.add(ws);
    return { ...ws, id };
}

export async function updateWorkspace(ws: Workspace) {
    if (ws.id === undefined) throw new Error("Workspace ID is missing");
    await db.workspaces.put(ws);
}

export async function deleteWorkspace(id: number) {
    await db.notes.where('id_workspace').equals(id).delete();
    await db.workspaces.delete(id);
}
