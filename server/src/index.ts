import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import healthRouter from './routes/health'
import generateRouter from './routes/generate'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api', healthRouter)
app.use('/api', generateRouter)

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
