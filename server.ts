import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the environment.');
  }
  return new GoogleGenAI({ apiKey });
};

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms)),
  ]);
}

// 1. Image Generation using gemini-nano-banana-2.1
app.post('/api/images/generate', async (req, res) => {
  try {
    const { prompt, aspectRatio = '1:1' } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      return res.json({
        isDemo: true,
        notice: 'GEMINI_API_KEY is not configured. Falling back to high-fidelity client demo.',
        imageUrl: null,
      });
    }

    const ai = getGenAI();
    const interaction: any = await withTimeout(
      ai.interactions.create({
        model: 'gemini-nano-banana-2.1',
        input: prompt,
        response_modalities: ['image', 'text'],
        generation_config: {
          image_config: {
            aspect_ratio: aspectRatio,
            image_size: '1K',
          },
        },
      }),
      4500,
      'Timed out waiting for gemini-nano-banana-2.1 (paid tier required).'
    );

    let imageUrl: string | null = null;
    if (interaction.output_image?.data) {
      imageUrl = `data:${interaction.output_image.mime_type || 'image/png'};base64,${interaction.output_image.data}`;
    } else {
      for (const step of interaction.steps || []) {
        if (step.type === 'model_output') {
          const img: any = (step as any).content?.find((c: any) => c.type === 'image');
          if (img && img.data) {
            imageUrl = `data:${img.mime_type || 'image/png'};base64,${img.data}`;
            break;
          }
        }
      }
    }

    if (!imageUrl) {
      return res.json({
        isDemo: true,
        notice: 'No image was returned by the model. Falling back to demo generator.',
        imageUrl: null,
      });
    }

    return res.json({ imageUrl, prompt, aspectRatio });
  } catch (error: any) {
    console.error('Image generation error:', error);
    return res.json({
      isDemo: true,
      error: error.message || 'Error occurred while calling gemini-nano-banana-2.1',
      imageUrl: null,
    });
  }
});

// 2. Image Editing using gemini-nano-banana-2.1
app.post('/api/images/edit', async (req, res) => {
  try {
    const { imageBase64, prompt, aspectRatio = '1:1' } = req.body;
    if (!imageBase64 || !prompt) {
      return res.status(400).json({ error: 'Both image and editing prompt are required' });
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      return res.json({
        isDemo: true,
        notice: 'GEMINI_API_KEY is not configured. Falling back to high-fidelity client demo.',
        imageUrl: null,
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+]+;base64,/, '');
    const match = imageBase64.match(/^data:(image\/[a-z0-9+]+);base64,/);
    const mimeType = match ? match[1] : 'image/png';

    const ai = getGenAI();
    const interaction: any = await withTimeout(
      ai.interactions.create({
        model: 'gemini-nano-banana-2.1',
        input: [
          {
            type: 'image',
            data: cleanBase64,
            mime_type: mimeType,
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
        response_modalities: ['image', 'text'],
        generation_config: {
          image_config: {
            aspect_ratio: aspectRatio,
            image_size: '1K',
          },
        },
      }),
      4500,
      'Timed out waiting for gemini-nano-banana-2.1.'
    );

    let imageUrl: string | null = null;
    if (interaction.output_image?.data) {
      imageUrl = `data:${interaction.output_image.mime_type || 'image/png'};base64,${interaction.output_image.data}`;
    } else {
      for (const step of interaction.steps || []) {
        if (step.type === 'model_output') {
          const img: any = (step as any).content?.find((c: any) => c.type === 'image');
          if (img && img.data) {
            imageUrl = `data:${img.mime_type || 'image/png'};base64,${img.data}`;
            break;
          }
        }
      }
    }

    if (!imageUrl) {
      return res.json({
        isDemo: true,
        notice: 'No edited image was returned. Falling back to demo generator.',
        imageUrl: null,
      });
    }

    return res.json({ imageUrl, prompt });
  } catch (error: any) {
    console.error('Image edit error:', error);
    return res.json({
      isDemo: true,
      error: error.message || 'Failed to edit image',
      imageUrl: null,
    });
  }
});

// 3. Animate Photo to Video using gemini-omni-1.1-flash via Interactions API
app.post('/api/videos/animate', async (req, res) => {
  try {
    const { imageBase64, prompt, aspectRatio = '16:9' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Photo is required for video animation' });
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      return res.json({
        isDemo: true,
        notice: 'GEMINI_API_KEY is not configured. Falling back to high-fidelity client animation.',
        videoUrl: null,
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+]+;base64,/, '');
    const match = imageBase64.match(/^data:(image\/[a-z0-9+]+);base64,/);
    const mimeType = match ? match[1] : 'image/png';

    const ai = getGenAI();
    const interaction: any = await withTimeout(
      ai.interactions.create({
        model: 'gemini-omni-1.1-flash',
        input: [
          {
            type: 'image',
            mime_type: mimeType,
            data: cleanBase64,
          },
          {
            type: 'text',
            text:
              prompt ||
              'Animate this photo with smooth dynamic cinematic camera motion and lively realistic environmental movements.',
          },
        ],
        background: false,
        store: false,
        stream: false,
        response_format: {
          type: 'video',
          aspect_ratio: aspectRatio === '9:16' ? '9:16' : '16:9',
          duration: '5s',
          resolution: '720p',
        },
      }),
      4500,
      'Timed out waiting for gemini-omni-1.1-flash.'
    );

    let videoUrl: string | null = null;
    if (interaction.output_video?.data) {
      videoUrl = `data:${interaction.output_video.mime_type || 'video/mp4'};base64,${interaction.output_video.data}`;
    } else if (interaction.output_video?.uri) {
      videoUrl = interaction.output_video.uri;
    } else {
      for (const step of interaction.steps || []) {
        if (step.type === 'model_output') {
          const vid: any = (step as any).content?.find((c: any) => c.type === 'video');
          if (vid && vid.data) {
            videoUrl = `data:${vid.mime_type || 'video/mp4'};base64,${vid.data}`;
            break;
          } else if (vid && vid.uri) {
            videoUrl = vid.uri;
            break;
          }
        }
      }
    }

    if (!videoUrl) {
      return res.json({
        isDemo: true,
        notice: 'No video returned by gemini-omni-1.1-flash. Falling back to client animation.',
        videoUrl: null,
      });
    }

    return res.json({ videoUrl, prompt, aspectRatio });
  } catch (error: any) {
    console.error('Video animation error:', error);
    return res.json({
      isDemo: true,
      error: error.message || 'Failed to animate video',
      videoUrl: null,
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ScrollSnip Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
