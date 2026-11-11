import { useCallback, useState } from "react";

// Wraps a payment mutation so a 409 { duplicate: true } from the API opens a
// confirm dialog instead of showing an error. "Record anyway" resends the
// same payload with confirm_duplicate: true and the same callbacks; "Cancel"
// saves nothing and leaves the form as it was.
export function useDuplicateReceiptGuard(mutation) {
  const [pending, setPending] = useState(null); // { payload, options, existing }

  const submit = useCallback(
    (payload, options = {}) => {
      mutation.mutate(payload, {
        ...options,
        onError: (error, vars, ctx) => {
          if (
            error?.status === 409 &&
            error?.payload?.duplicate === true &&
            payload?.confirm_duplicate !== true
          ) {
            mutation.reset(); // the dialog replaces the error message
            setPending({
              payload,
              options,
              existing: error.payload.existing || [],
            });
            return;
          }
          options.onError?.(error, vars, ctx);
        },
      });
    },
    [mutation],
  );

  const cancel = useCallback(() => setPending(null), []);

  const confirm = useCallback(() => {
    if (!pending) return;
    const { payload, options } = pending;
    setPending(null);
    submit({ ...payload, confirm_duplicate: true }, options);
  }, [pending, submit]);

  return { submit, pendingDuplicate: pending, cancel, confirm };
}
