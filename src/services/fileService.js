// File upload service — stores files in Firebase Storage.
// Falls back to a local object URL when Firebase Storage is not configured.

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, isFirebaseConfigured } from './firebase';
import { auth } from './firebase';

function getCurrentUserId() {
  if (!isFirebaseConfigured || !auth) return 'local-user';
  return auth.currentUser?.uid || 'anonymous';
}

export const fileService = {
  /**
   * Upload a file to Firebase Storage (or create a local object URL as fallback).
   * @param {object} options
   * @param {File} options.file - The File object to upload
   * @returns {Promise<{url: string, name: string, size: number, type: string}>}
   */
  async UploadFile({ file }) {
    if (!file) throw new Error('No file provided');

    // Local fallback: create a temporary object URL
    if (!isFirebaseConfigured || !storage) {
      const url = URL.createObjectURL(file);
      return { url, name: file.name, size: file.size, type: file.type };
    }

    try {
      const userId = getCurrentUserId();
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `uploads/${userId}/${timestamp}_${safeName}`;
      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      return { url, name: file.name, size: file.size, type: file.type, path: storagePath };
    } catch (err) {
      console.warn('[Storage] Upload failed, using local URL:', err.message);
      const url = URL.createObjectURL(file);
      return { url, name: file.name, size: file.size, type: file.type };
    }
  },
};
