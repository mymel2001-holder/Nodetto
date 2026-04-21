import { argon2id } from 'hash-wasm';
import * as bip39 from 'bip39';

export interface NoteMetadata {
    title: string;
    parent_id: string | null;
    is_folder: boolean;
    folder_open: boolean;
}

export interface NoteData {
    id: string;
    title: string;
    parent_id: string | null;
    is_folder: boolean;
    folder_open: boolean;
    content: string;
    updated_at: number;
    deleted: boolean;
}

/**
 * Derives a key from a password and salt using Argon2id.
 * Matching Rust parameters: time=1, mem=64MB, parallelism=4
 */
async function deriveKey(password: string, salt: string): Promise<Uint8Array> {
    const saltBytes = new TextEncoder().encode(salt);
    const hash = await argon2id({
        password: password,
        salt: saltBytes,
        parallelism: 4,
        iterations: 1,
        memorySize: 65536, // 64MB in KB
        hashLength: 32,
        outputType: 'binary'
    });
    return hash as Uint8Array;
}

/**
 * Generates a fresh AES-256-GCM master encryption key (MEK) and encrypts it with a
 * BIP-39 recovery key.
 */
export async function createWorkspace() {
    const masterEncryptionKey = crypto.getRandomValues(new Uint8Array(32));
    const recoveryKeyData = bip39.generateMnemonic(256); // 24 words
    
    const saltRecoveryData = crypto.getRandomValues(new Uint8Array(16));
    const saltRecoveryDataStr = btoa(String.fromCharCode(...saltRecoveryData));

    const recoveryKeyHash = await deriveKey(recoveryKeyData, saltRecoveryDataStr);
    
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        recoveryKeyHash,
        'AES-GCM',
        false,
        ['encrypt']
    );

    const mekRecoveryNonce = crypto.getRandomValues(new Uint8Array(12));
    const encryptedMekRecovery = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: mekRecoveryNonce },
        cryptoKey,
        masterEncryptionKey
    );

    return {
        master_encryption_key: Array.from(masterEncryptionKey),
        recovery_key_data: recoveryKeyData,
        salt_recovery_data: saltRecoveryDataStr,
        mek_recovery_nonce: Array.from(mekRecoveryNonce),
        encrypted_mek_recovery: Array.from(new Uint8Array(encryptedMekRecovery))
    };
}

/**
 * Derives server-side hashes and encrypts the MEK with the password.
 */
export async function createAccount(password: string, mek: Uint8Array) {
    const recoveryKeyAuth = bip39.generateMnemonic(256);
    
    const saltAuth = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const saltData = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const saltRecoveryAuth = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const saltServerAuth = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const saltServerRecovery = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));

    const passwordHashAuth = await argon2id({ password: password, salt: new TextEncoder().encode(saltAuth), parallelism: 4, iterations: 1, memorySize: 65536, hashLength: 32, outputType: 'encoded' });
    const recoveryHashAuth = await argon2id({ password: recoveryKeyAuth, salt: new TextEncoder().encode(saltRecoveryAuth), parallelism: 4, iterations: 1, memorySize: 65536, hashLength: 32, outputType: 'encoded' });

    const passwordHashData = await deriveKey(password, saltData);
    
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        passwordHashData,
        'AES-GCM',
        false,
        ['encrypt']
    );

    const mekPasswordNonce = crypto.getRandomValues(new Uint8Array(12));
    const encryptedMekPassword = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: mekPasswordNonce },
        cryptoKey,
        mek
    );

    const storedPasswordHash = await argon2id({ password: passwordHashAuth, salt: new TextEncoder().encode(saltServerAuth), parallelism: 4, iterations: 1, memorySize: 65536, hashLength: 32, outputType: 'encoded' });
    const storedRecoveryHash = await argon2id({ password: recoveryHashAuth, salt: new TextEncoder().encode(saltServerRecovery), parallelism: 4, iterations: 1, memorySize: 65536, hashLength: 32, outputType: 'encoded' });

    return {
        recovery_key_auth: recoveryKeyAuth,
        salt_auth: saltAuth,
        salt_data: saltData,
        salt_recovery_auth: saltRecoveryAuth,
        salt_server_auth: saltServerAuth,
        salt_server_recovery: saltServerRecovery,
        mek_password_nonce: Array.from(mekPasswordNonce),
        encrypted_mek_password: Array.from(new Uint8Array(encryptedMekPassword)),
        stored_password_hash: storedPasswordHash,
        stored_recovery_hash: storedRecoveryHash
    };
}

/**
 * Derives the login hash from the password.
 */
export async function login(loginRequest: { salt_auth: string, salt_server_auth: string }, password: string): Promise<string> {
    const passwordHashAuth = await argon2id({ password: password, salt: new TextEncoder().encode(loginRequest.salt_auth), parallelism: 4, iterations: 1, memorySize: 65536, hashLength: 32, outputType: 'encoded' });
    const storedPasswordHash = await argon2id({ password: passwordHashAuth, salt: new TextEncoder().encode(loginRequest.salt_server_auth), parallelism: 4, iterations: 1, memorySize: 65536, hashLength: 32, outputType: 'encoded' });
    return storedPasswordHash;
}

/**
 * Decrypts the MEK using the password.
 */
export async function decryptMek(password: string, encryptedMekPassword: Uint8Array, saltData: string, mekPasswordNonce: Uint8Array): Promise<Uint8Array> {
    const passwordHashData = await deriveKey(password, saltData);
    
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        passwordHashData,
        'AES-GCM',
        false,
        ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: mekPasswordNonce },
        cryptoKey,
        encryptedMekPassword
    );

    return new Uint8Array(decrypted);
}

/**
 * Encrypts data with a key.
 */
export async function encryptData(data: Uint8Array, key: Uint8Array): Promise<{ ciphertext: Uint8Array, nonce: Uint8Array }> {
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        'AES-GCM',
        false,
        ['encrypt']
    );

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        cryptoKey,
        data
    );

    return {
        ciphertext: new Uint8Array(ciphertext),
        nonce: nonce
    };
}

/**
 * Decrypts data with a key.
 */
export async function decryptData(ciphertext: Uint8Array, nonce: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        'AES-GCM',
        false,
        ['decrypt']
    );

    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonce },
        cryptoKey,
        ciphertext
    );

    return new Uint8Array(plaintext);
}
