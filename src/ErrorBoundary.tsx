import type { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useLocation } from "react-router-dom";
import { ErrorState } from "./components/states/ErrorState";

export function WithErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <ErrorBoundary
      resetKeys={[location.pathname]}
      FallbackComponent={({ resetErrorBoundary }) => (
        <div className="p-6">
          <ErrorState
            title="This page ran into a problem"
            message="Something went wrong while rendering this page. Try again, or use the navigation to go elsewhere."
            onRetry={resetErrorBoundary}
          />
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
