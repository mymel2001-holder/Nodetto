import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { QuickDB } from 'quick.db';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize QuickDB
const db = new QuickDB();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Middleware to verify token
async function verifyToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { username, token } = req.body.token ? req.body : req.query;
    if (!username || !token) {
        return res.status(401).json({ message: 'Missing username or token' });
    }

    const user: any = await db.get(`users.${username}`);
    if (!user) {
        return res.status(404).json({ message: "User doesn't exist" });
    }

    const tokens: any[] = await db.get(`tokens.${user.id}`) || [];
    const tokenBytes = Buffer.from(token, 'hex'); // Assuming token is hex string from client
    
    // In Rust version, token was Vec<u8>. Client sends hex.
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

    const existingUser = await db.get(`users.${user.username}`);
    if (existingUser) {
        return res.status(409).json({ message: 'This username already exist' });
    }

    // Assign an ID if not present
    if (!user.id) {
        const lastId = (await db.get('config.last_user_id')) || 0;
        user.id = lastId + 1;
        await db.set('config.last_user_id', user.id);
    }

    await db.set(`users.${user.username}`, user);
    console.log('create_account: completed');
    res.sendStatus(200);
});

app.get('/login', async (req, res) => {
    const { username } = req.query;
    const user: any = await db.get(`users.${username}`);

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
    const user: any = await db.get(`users.${username}`);

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

    const tokens: any[] = await db.get(`tokens.${user.id}`) || [];
    tokens.push(userToken);
    await db.set(`tokens.${user.id}`, tokens);

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

    for (const note of notes) {
        const existingNote: any = await db.get(`notes.${user.id}.${note.uuid}`);

        if (existingNote) {
            if (existingNote.updated_at > note.updated_at && !force) {
                results.push({
                    uuid: existingNote.uuid,
                    status: { Conflict: existingNote }
                });
            } else {
                note.updated_at = Math.floor(Date.now() / 1000);
                await db.set(`notes.${user.id}.${note.uuid}`, note);
                results.push({ uuid: note.uuid, status: 'Ok' });
            }
        } else {
            note.updated_at = Math.floor(Date.now() / 1000);
            await db.set(`notes.${user.id}.${note.uuid}`, note);
            results.push({ uuid: note.uuid, status: 'Ok' });
        }
    }

    res.json(results);
});

app.get('/notes', verifyToken, async (req, res) => {
    const { updated_at } = req.query;
    const user = (req as any).user;
    const minTimestamp = parseInt(updated_at as string) || 0;

    const allNotes: any = await db.get(`notes.${user.id}`) || {};
    const filteredNotes = Object.values(allNotes).filter((note: any) => note.updated_at > minTimestamp);

    res.json(filteredNotes);
});

app.get('/note', verifyToken, async (req, res) => {
    const { note_id } = req.query;
    const user = (req as any).user;

    const note = await db.get(`notes.${user.id}.${note_id}`);
    if (!note) {
        return res.status(404).json({ message: "Note doesn't exist" });
    }

    res.json(note);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
