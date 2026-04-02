use core::panic;

use aes_gcm::{Aes256Gcm, Key};
use chrono::{DateTime, Local, NaiveDateTime};
use rusqlite::Connection;
use serde::Serialize;
use tauri_plugin_log::log::{debug, trace};
use uuid::{NoContext, Uuid};

use crate::{
    crypt::{self, NoteData},
    db::schema::{Common, Note, Workspace},
};

//TODO: refactor this, data encryption and stuff should not be inside db?
pub fn create_note(
    conn: &Connection,
    id_workspace: u32,
    title: String,
    parent_id: Option<String>,
    is_folder: bool,
    mek: Key<Aes256Gcm>,
) -> Result<String, Box<dyn std::error::Error>> {
    let (content, nonce) = crypt::encrypt_data("".as_bytes(), &mek).unwrap(); //Content empty because it's first note
    
    let metadata_ser = serde_json::to_vec(&crypt::NoteMetadata { 
        title, 
        parent_id, 
        is_folder, 
        folder_open: true 
    }).unwrap();
    let (metadata, metadata_nonce) = crypt::encrypt_data(&metadata_ser, &mek).unwrap();

    let note = Note {
        uuid: Uuid::new_v7(uuid::Timestamp::now(NoContext)).to_string(),
        id_workspace: Some(id_workspace),
        content,
        nonce,
        metadata,
        metadata_nonce,
        updated_at: Local::now().to_utc().timestamp(),
        synched: false,
        deleted: false,
    };

    note.insert(conn).unwrap();

    Ok(note.uuid)
}

pub fn get_note(
    conn: &Connection,
    uuid: String,
    mek: Key<Aes256Gcm>,
) -> Result<NoteData, Box<dyn std::error::Error>> {
    let note = Note::select(conn, uuid).unwrap().unwrap();

    let content_plaintext = crypt::decrypt_data(&note.content, &note.nonce, &mek)?;
    let metadata_plaintext = crypt::decrypt_data(&note.metadata, &note.metadata_nonce, &mek)?;

    let metadata: crypt::NoteMetadata = serde_json::from_slice(&metadata_plaintext)?;

    let decrypted_note = NoteData {
        id: note.uuid,
        title: metadata.title,
        parent_id: metadata.parent_id,
        is_folder: metadata.is_folder,
        folder_open: metadata.folder_open,
        content: String::from_utf8(content_plaintext).unwrap(),
        updated_at: note.updated_at,
        deleted: note.deleted,
    };

    Ok(decrypted_note)
}

pub fn get_notes(
    conn: &Connection,
    id_workspace: u32,
) -> Result<Vec<Note>, Box<dyn std::error::Error>> {
    let notes = Note::select_all(conn, id_workspace).unwrap();

    Ok(notes)
}

pub fn update_note(
    conn: &Connection,
    note_data: NoteData,
    mek: Key<Aes256Gcm>,
) -> Result<(), Box<dyn std::error::Error>> {
    let (content, nonce) = crypt::encrypt_data(note_data.content.as_bytes(), &mek).unwrap();

    let metadata_ser = serde_json::to_vec(&crypt::NoteMetadata { 
        title: note_data.title,
        parent_id: note_data.parent_id,
        is_folder: note_data.is_folder,
        folder_open: note_data.folder_open,
    }).unwrap();
    let (metadata, metadata_nonce) =
        crypt::encrypt_data(&metadata_ser, &mek).unwrap();

    let mut note = Note::select(conn, note_data.id).unwrap().unwrap();

    note.content = content;
    note.nonce = nonce;
    note.metadata = metadata;
    note.metadata_nonce = metadata_nonce;
    note.updated_at = Local::now().to_utc().timestamp();
    note.synched = false;
    note.deleted = note_data.deleted;

    note.update(conn).unwrap();

    debug!("note updated: dt:{}", note.updated_at);
    Ok(())
}

pub fn create_workspace(
    conn: &Connection,
    workspace_name: String,
) -> Result<Workspace, Box<dyn std::error::Error>> {
    let workspace_encryption_data = crypt::create_workspace();

    let mut workspace = Workspace {
        id: None,
        workspace_name,
        username: None,
        master_encryption_key: workspace_encryption_data.master_encryption_key,
        salt_recovery_data: workspace_encryption_data.salt_recovery_data.to_string(),
        mek_recovery_nonce: workspace_encryption_data.mek_recovery_nonce,
        encrypted_mek_recovery: workspace_encryption_data.encrypted_mek_recovery,
        token: None,
        instance: None,
    };

    workspace.insert(&conn).unwrap();

    workspace.id = Some(conn.last_insert_rowid() as u32);

    //TODO: send recovery keys to frontend

    Ok(workspace)
}

pub fn update_workspace(conn: &Connection, new_workspace: Workspace) {
    new_workspace.update(conn).unwrap();
}

pub fn get_workspace(
    conn: &Connection,
    workspace_name: String,
) -> Result<Option<Workspace>, Box<dyn std::error::Error>> {
    let workspace = Workspace::select(conn, workspace_name).unwrap();

    Ok(workspace)
}

pub fn get_workspaces(conn: &Connection) -> Result<Vec<Workspace>, Box<dyn std::error::Error>> {
    let workspaces = Workspace::select_all(conn).unwrap();

    Ok(workspaces)
}

fn common_insert_or_update(
    conn: &Connection,
    key: String,
    value: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match Common::select(&conn, key.clone())? {
        Some(mut common) => {
            common.value = value;

            common.update(conn)?;
        }
        None => {
            let common = Common { key, value };

            common.insert(conn)?;
        }
    }

    Ok(())
}

pub fn set_logged_workspace(conn: &Connection, workspace: Option<Workspace>) {
    match workspace {
        Some(workspace) => {
            common_insert_or_update(conn, "logged".to_string(), workspace.workspace_name).unwrap()
        }
        None => Common::delete(conn, "logged".to_string()),
    }
}

pub fn get_logged_workspace(conn: &Connection) -> Option<Workspace> {
    match Common::select(conn, "logged".to_string()).unwrap() {
        Some(lu) => Some(Workspace::select(conn, lu.value).unwrap().unwrap()),
        None => None,
    }
}

pub fn set_latest_note(conn: &Connection, uuid: Option<String>) {
    match uuid {
        Some(uuid) => common_insert_or_update(conn, "latest_note".to_string(), uuid).unwrap(),
        None => Common::delete(conn, "latest_note".to_string()),
    }
}

pub fn get_latest_note(conn: &Connection) -> Option<String> {
    match Common::select(conn, "latest_note".to_string()).unwrap() {
        Some(lu) => Some(lu.value),
        None => None,
    }
}

pub fn logout_workspace(conn: &Connection, workspace_name: String) {
    let workspace = Workspace::select(conn, workspace_name).unwrap().unwrap();

    //TODO: This doesn't feel right without stopping sync
    Note::delete_all_from_workspace(conn, workspace.id.unwrap());
    workspace.delete(conn).unwrap();

    Common::delete(conn, "logged".to_string());
}

pub fn sync_logout_workspace(conn: &Connection, workspace_name: String) {
    let mut workspace = Workspace::select(conn, workspace_name).unwrap().unwrap();

    workspace.username = None;
    workspace.token = None;
    workspace.instance = None;

    workspace.update(conn).unwrap();
}
