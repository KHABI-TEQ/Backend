/**
 * Shim so Resend's type definitions (which import 'react') compile.
 * This project does not use React; only Resend's batch email API is used.
 */
declare module "react" {
  namespace React {
    type ReactNode = string | number | boolean | null | undefined | object;
  }
  export = React;
}
