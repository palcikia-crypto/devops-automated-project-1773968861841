import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import fs from "fs/promises";
import { Client } from "ssh2";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sshClient: Client | null = null;
let sshConfig: any = null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/status", (req, res) => {
    res.json({ 
      status: sshClient ? "connected" : "local", 
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: process.platform,
      remote: !!sshClient
    });
  });

  // SSH Connection endpoint
  app.post("/api/ssh/connect", (req, res) => {
    const { host, username, password, port = 22 } = req.body;
    
    if (sshClient) {
      sshClient.end();
      sshClient = null;
    }

    const conn = new Client();
    conn.on('ready', () => {
      sshClient = conn;
      sshConfig = { host, username, port };
      res.json({ success: true, message: `Подключено к ${host}` });
    }).on('error', (err) => {
      res.status(500).json({ error: err.message });
    }).connect({
      host,
      port,
      username,
      password
    });
  });

  app.post("/api/ssh/disconnect", (req, res) => {
    if (sshClient) {
      sshClient.end();
      sshClient = null;
      sshConfig = null;
    }
    res.json({ success: true });
  });

  // Terminal execution endpoint (Local or Remote)
  app.post("/api/terminal", (req, res) => {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: "No command provided" });

    if (sshClient) {
      sshClient.exec(command, (err, stream) => {
        if (err) return res.status(500).json({ error: err.message });
        
        let stdout = '';
        let stderr = '';
        stream.on('close', (code: number) => {
          res.json({ stdout, stderr, exitCode: code });
        }).on('data', (data: any) => {
          stdout += data.toString();
        }).stderr.on('data', (data: any) => {
          stderr += data.toString();
        });
      });
    } else {
      exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
        res.json({
          stdout: stdout || "",
          stderr: stderr || "",
          exitCode: error ? error.code : 0
        });
      });
    }
  });

  // File management endpoints (Local or Remote)
  app.get("/api/files/list", async (req, res) => {
    const dir = (req.query.path as string) || ".";
    
    if (sshClient) {
      sshClient.sftp((err, sftp) => {
        if (err) return res.status(500).json({ error: err.message });
        sftp.readdir(dir, (err, list) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(list.map(f => ({
            name: f.filename,
            isDirectory: f.longname.startsWith('d')
          })));
        });
      });
    } else {
      try {
        const files = await fs.readdir(path.join(process.cwd(), dir), { withFileTypes: true });
        res.json(files.map(f => ({
          name: f.name,
          isDirectory: f.isDirectory()
        })));
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.post("/api/files/read", async (req, res) => {
    const { filePath } = req.body;
    
    if (sshClient) {
      sshClient.sftp((err, sftp) => {
        if (err) return res.status(500).json({ error: err.message });
        const stream = sftp.createReadStream(filePath);
        let content = '';
        stream.on('data', (data) => {
          content += data.toString();
        }).on('end', () => {
          res.json({ content });
        }).on('error', (err) => {
          res.status(500).json({ error: err.message });
        });
      });
    } else {
      try {
        const content = await fs.readFile(path.join(process.cwd(), filePath), "utf-8");
        res.json({ content });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.post("/api/files/write", async (req, res) => {
    const { filePath, content } = req.body;
    
    if (sshClient) {
      sshClient.sftp((err, sftp) => {
        if (err) return res.status(500).json({ error: err.message });
        const stream = sftp.createWriteStream(filePath);
        stream.on('close', () => {
          res.json({ success: true });
        }).on('error', (err) => {
          res.status(500).json({ error: err.message });
        });
        stream.write(content);
        stream.end();
      });
    } else {
      try {
        await fs.writeFile(path.join(process.cwd(), filePath), content, "utf-8");
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
