import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import healthRouter from './routes/health'
import generateRouter from './routes/generate'
import generationsRouter from './routes/generations'
import loginRouter from './routes/login'

const app = express()

app.use(cors())
// Generated concept images arrive as base64 data URLs; the 100kb default
// would reject them outright.
app.use(express.json({ limit: '50mb' }))

app.use('/api', healthRouter)
app.use('/api', generateRouter)
app.use('/api', generationsRouter)
app.use('/api', loginRouter)

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
