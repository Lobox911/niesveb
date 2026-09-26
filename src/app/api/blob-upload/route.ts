import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSession } from "@/lib/auth";

/**
 * Issues a short-lived token so the browser can upload straight to Vercel Blob.
 *
 * Uploads used to go through a server action, which put the file bytes in the
 * request body — and Vercel caps a function request at 4.5MB, whatever limit
 * the code checks. A phone photo of a flyer clears that easily, and the upload
 * failed at the edge with a 413 before any of our code ran. Going browser →
 * Blob removes the ceiling entirely; the action afterwards carries only a URL.
 */

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "application/pdf",
];

/**
 * Proof of payment is uploaded by the participant, who has no account — there
 * is nobody to authenticate. So this one prefix is open, and is kept narrow to
 * limit what that buys an abuser: photographs and PDFs only, 5MB, and nothing
 * outside `proofs/`. Everything else on the store still requires an admin.
 */
const PUBLIC_PREFIX = "proofs/";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (pathname.startsWith(PUBLIC_PREFIX)) {
          return {
            allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
            maximumSizeInBytes: 5 * 1024 * 1024,
            addRandomSuffix: true,
          };
        }

        // The token is what authorises writing to the store, so the check
        // belongs here. Without it the endpoint is an open upload bucket.
        const session = await getSession();
        if (!session || session.role !== "admin") {
          throw new Error("Only a branch administrator can upload files.");
        }

        return {
          allowedContentTypes: IMAGE_TYPES,
          maximumSizeInBytes: 15 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // The row is written by the server action using the returned URL, so
        // there is nothing to do here. Vercel only calls this in production.
      },
    });

    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Upload failed." },
      { status: 400 },
    );
  }
}