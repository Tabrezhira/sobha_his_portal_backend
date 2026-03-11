import { google } from "googleapis";
import { createReadStream } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KEYFILE_PATH = path.join(__dirname, "../authfile/sobha-489906-26803a8ba718.json");
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

// Replace with your actual Google Drive folder ID
const DRIVE_FOLDER_ID = "127FA9TJtoiW4in4aANj5I62uxkhRDC1S";

const getAuthClient = () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILE_PATH,
    scopes: SCOPES,
  });
  return auth;
};

export const uploadFileToDrive = async (file) => {
  const auth = getAuthClient();
  const drive = google.drive({ version: "v3", auth });

  const fileMetadata = {
    name: file.originalname,
    parents: [DRIVE_FOLDER_ID],
  };

  const media = {
    mimeType: file.mimetype,
    body: createReadStream(file.path),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id, name, webViewLink, webContentLink",
  });

  // Make file publicly accessible
  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return {
    fileId: response.data.id,
    fileName: response.data.name,
    webViewLink: response.data.webViewLink,
    webContentLink: response.data.webContentLink,
  };
};

export const deleteFileFromDrive = async (fileId) => {
  const auth = getAuthClient();
  const drive = google.drive({ version: "v3", auth });
  await drive.files.delete({ fileId });
};