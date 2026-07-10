// base44Client — compatibility shim so existing code continues to work
// while the real backend is now Firebase + local services.
// Base44 is no longer required for the application to function.

import { authService } from '@/services/authService';
import { entities } from '@/services/firestoreService';
import { llmService } from '@/services/llmService';
import { fileService } from '@/services/fileService';

export const base44 = {
  auth: authService,
  entities,
  integrations: {
    Core: {
      InvokeLLM: (opts) => llmService.InvokeLLM(opts),
      GenerateSpeech: (opts) => llmService.GenerateSpeech(opts),
      GenerateImage: (opts) => llmService.GenerateImage(opts),
      UploadFile: (opts) => fileService.UploadFile(opts),
      ExtractDataFromUploadedFile: (opts) => llmService.ExtractDataFromUploadedFile(opts),
    },
  },
};
