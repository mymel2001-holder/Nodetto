import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { QuickDB } from 'quick.db';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

process.on('uncaughtException', (err) => {
    console.error('FATAL: Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('FATAL: Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

const app = express();
const port = process.env.PORT || 3000;

console.log('Initializing database...');
// Initialize QuickDB with explicit file
const db = new QuickDB({ filePath: 'nodetto.sqlite' });
const usersTable = db.table('users');
const tokensTable = db.table('tokens');
const notesTable = db.table('notes');
const configTable = db.table('config');

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (req, res) => {
    res.send('Nodetto Server is running');
});

// Middleware to verify token
async function verifyToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    const username = (req.body?.username || req.query.username) as string;
    const token = (req.body?.token || req.query.token) as string | number[];

    if (!username || !token) {
        return res.status(401).json({ message: 'Missing username or token' });
    }

    const user: any = await usersTable.get(username as string);
    if (!user) {
        return res.status(404).json({ message: "User doesn't exist" });
    }

    const tokens: any[] = await tokensTable.get(user.id.toString()) || [];
    const tokenBytes = typeof token === 'string' 
        ? Buffer.from(token, 'hex') 
        : Buffer.from(token as any);
    
    const valid = tokens.some(t => Buffer.from(t.token).equals(tokenBytes));

    if (!valid) {
        return res.status(403).json({ message: 'Forbidden' });
    }

    (req as any).user = user;
    next();
}

app.post('/create_account', async (req, res) => {
    const user = req.body;
    console.log('received create_account', user.username);

    const existingUser = await usersTable.get(user.username);
    if (existingUser) {
        return res.status(409).json({ message: 'This username already exist' });
    }

    // Assign an ID if not present
    if (!user.id) {
        const lastId = (await configTable.get('last_user_id')) || 0;
        user.id = lastId + 1;
        await configTable.set('last_user_id', user.id);
    }

    await usersTable.set(user.username, user);
    console.log('create_account: completed');
    res.sendStatus(200);
});

app.get('/login', async (req, res) => {
    const { username } = req.query;
    const user: any = await usersTable.get(username as string);

    if (!user) {
        return res.status(404).json({ message: "User doesn't exist" });
    }

    res.json({
        salt_auth: user.salt_auth,
        salt_server_auth: user.salt_server_auth
    });
});

app.post('/login', async (req, res) => {
    const { username, login_hash } = req.body;
    const user: any = await usersTable.get(username as string);

    if (!user) {
        return res.status(404).json({ message: "User doesn't exist" });
    }

    if (login_hash !== user.stored_password_hash) {
        return res.status(401).json({ message: 'Wrong password' });
    }

    const token = Buffer.alloc(32);
    require('crypto').randomFillSync(token);

    const userToken = {
        id_user: user.id,
        token: Array.from(token) // Store as array for QuickDB/JSON compatibility
    };

    const tokens: any[] = await tokensTable.get(user.id.toString()) || [];
    tokens.push(userToken);
    await tokensTable.set(user.id.toString(), tokens);

    res.json({
        salt_data: user.salt_data,
        encrypted_mek_password: user.encrypted_mek_password,
        mek_password_nonce: user.mek_password_nonce,
        token: Array.from(token)
    });
});

app.post('/notes', verifyToken, async (req, res) => {
    const { notes, force } = req.body;
    const user = (req as any).user;
    const results = [];

    const userNotesTable = notesTable.table(`u${user.id}`);

    for (const note of notes) {
        const existingNote: any = await userNotesTable.get(note.uuid);

        if (existingNote) {
            if (existingNote.updated_at > note.updated_at && !force) {
                results.push({
                    uuid: existingNote.uuid,
                    status: { Conflict: existingNote }
                });
            } else {
                note.updated_at = Math.floor(Date.now() / 1000);
                await userNotesTable.set(note.uuid, note);
                results.push({ uuid: note.uuid, status: 'Ok', updated_at: note.updated_at });
            }
        } else {
            note.updated_at = Math.floor(Date.now() / 1000);
            await userNotesTable.set(note.uuid, note);
            results.push({ uuid: note.uuid, status: 'Ok', updated_at: note.updated_at });
        }
    }

    res.json(results);
});

app.get('/notes', verifyToken, async (req, res) => {
    const { updated_at } = req.query;
    const user = (req as any).user;
    const minTimestamp = parseInt(updated_at as string) || 0;

    const userNotesTable = notesTable.table(`u${user.id}`);
    const allNotes: any[] = await userNotesTable.all();
    const filteredNotes = allNotes
        .map(n => n.value)
        .filter((note: any) => note.updated_at >= minTimestamp);

    res.json(filteredNotes);
});

app.get('/note', verifyToken, async (req, res) => {
    const { note_id } = req.query;
    const user = (req as any).user;

    const userNotesTable = notesTable.table(`u${user.id}`);
    const note = await userNotesTable.get(note_id as string);
    if (!note) {
        return res.status(404).json({ message: "Note doesn't exist" });
    }

    res.json(note);
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Express Error:', err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
