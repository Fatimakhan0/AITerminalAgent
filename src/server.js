const express = require("express")
const bodyParser = require("body-parser")
const { spawn } = require("child_process")

const app = express()

app.use(bodyParser.json())
app.use(express.static("public"))

app.post("/run", (req, res) => {

    const userInput = req.body.command

    const python = spawn("python", ["python/agent.py", userInput])

    let output = ""
    let error = ""

    python.stdout.on("data", (data) => {
        output += data.toString()
    })

    python.stderr.on("data", (data) => {
        error += data.toString()
    })

    python.on("close", () => {

        console.log("PYTHON OUTPUT:", output)
        console.log("PYTHON ERROR:", error)

        if (error) {
            return res.json({ output: error })
        }

        if (!output.trim()) {
            return res.json({ output: "⚠️ No output from Python agent." })
        }

        res.json({ output: output })

    })

})

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000")
})