import express from 'express';
import redis from 'ioredis';
const Redis = new redis();
import NsfwCheck from './NSFWCheck.js';

const app = express();

const Nsfw = new NsfwCheck(redis);

app.get('/check/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'No id provided' });

    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const cached = await Redis.get(`nsfw:${id}`);
    if (cached) return res.json(JSON.parse(cached));

    const data = await Nsfw.getId(id, false);
    if (!data) {
        await Redis.set(`nsfw:${id}`, JSON.stringify({ error: 'Invalid id' }), 'EX', 60 * 30);
        return res.status(400).json({ error: 'Invalid id' });
    }

    const nsfw = await Nsfw.getNsfwScore(data);

    await Redis.set(`nsfw:${id}`, JSON.stringify(nsfw), 'EX', 60 * 60 * 24 * 7);

    return res.json(nsfw);
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(6918, () => console.log(`Listening on port 6918`));
