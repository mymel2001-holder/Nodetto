const { QuickDB } = require('quick.db');
const db = new QuickDB({ filePath: 'test.sqlite' });
const t1 = db.table('table1');
try {
    const t2 = t1.table('table2');
    console.log('SUCCESS');
} catch (e) {
    console.log('ERROR:', e.message);
}
