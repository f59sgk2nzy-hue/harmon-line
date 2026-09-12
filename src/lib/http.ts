import { NextResponse } from "next/server";
import { requestOrigin } from "./origin";

export { requestOrigin };

export function redirectPreservingHost(request: Request, destPath: string): NextResponse {
  const path = destPath.startsWith("/") ? destPath : `/${destPath}`;
  const location = `${requestOrigin(request)}${path}`;
  return new NextResponse(null, {
    status: 303,
    headers: { Location: location.includes("0.0.0.0") ? path : location },
  });
}
