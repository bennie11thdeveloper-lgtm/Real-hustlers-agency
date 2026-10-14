import { z } from "npm:zod@3.25.76";
import {
  createRouteHandler,
  createUploadthing,
  UTApi,
  UploadThingError,
} from "npm:uploadthing@7.7.4/server";
import { databaseRequest, verifyUploadToken } from "../_shared/database.ts";

const createUploadthingRoute = createUploadthing();

const router = {
  documentsUploader: createUploadthingRoute(
    {
      pdf: { maxFileSize: "4MB", maxFileCount: 5 },
      image: { maxFileSize: "4MB", maxFileCount: 5 },
    },
    { acl: "private", awaitServerData: true },
  )
    .input(z.object({
      applicationId: z.string().uuid(),
      uploadToken: z.string().min(80).max(160),
    }))
    .middleware(async ({ input }) => {
      const authorized = await verifyUploadToken(input.applicationId, input.uploadToken);
      if (!authorized) throw new UploadThingError("This upload link has expired. Please submit your application again.");

      const applications = await databaseRequest<Array<{ id: string }>>(
        "applications",
        `?id=eq.${encodeURIComponent(input.applicationId)}&select=id&limit=1`,
      );
      if (!applications.length) throw new UploadThingError("Application not found.");

      const existingFiles = await databaseRequest<Array<{ id: string }>>(
        "application_documents",
        `?application_id=eq.${encodeURIComponent(input.applicationId)}&select=id`,
      );
      if (existingFiles.length >= 5) throw new UploadThingError("A maximum of five documents can be uploaded.");

      return { applicationId: input.applicationId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        await databaseRequest("rpc/add_application_document", "", {
          method: "POST",
          body: {
            p_application_id: metadata.applicationId,
            p_file_key: file.key,
            p_file_name: file.name,
            p_content_type: file.type,
            p_file_size: file.size,
          },
        });
      } catch (error) {
        const cleanup = await new UTApi({ token: uploadToken }).deleteFiles(file.key);
        if (!cleanup.success) console.error("Could not remove an unregistered private document.");
        throw error;
      }

      return { uploaded: true };
    }),
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const uploadToken = Deno.env.get("UPLOADTHING_TOKEN");
if (!supabaseUrl || !uploadToken) throw new Error("UploadThing server configuration is missing.");

const uploadthingHandler = createRouteHandler({
  router,
  config: {
    token: uploadToken,
    callbackUrl: `${supabaseUrl}/functions/v1/uploadthing`,
  },
});

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  const configuredOrigin = Deno.env.get("APP_ORIGIN");

  if (request.method === "OPTIONS") {
    if (!origin || origin !== configuredOrigin) return new Response("Origin not allowed.", { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-uploadthing-version, x-uploadthing-package",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Vary": "Origin",
      },
    });
  }
  if (origin && origin !== configuredOrigin) return new Response("Origin not allowed.", { status: 403 });

  const response = await uploadthingHandler(request);
  if (!origin) return response;

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info, x-uploadthing-version, x-uploadthing-package");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
