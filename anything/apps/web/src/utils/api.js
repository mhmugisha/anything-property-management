export async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let message = `When fetching ${url}, the response was [${res.status}] ${res.statusText}`;
    try {
      const body = await res.json();
      const bodyError = typeof body?.error === "string" ? body.error : null;
      const bodyDetail = typeof body?.detail === "string" ? body.detail : null;
      if (bodyError) {
        message = `${message}: ${bodyError}`;
      }
      if (bodyDetail) {
        message = `${message} (${bodyDetail})`;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json();
}

export async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `When fetching ${url}, the response was [${res.status}] ${res.statusText}`;
    try {
      const payload = await res.json();
      const payloadError =
        typeof payload?.error === "string" ? payload.error : null;
      const payloadDetail =
        typeof payload?.detail === "string" ? payload.detail : null;
      if (payloadError) {
        // Just use the clean error message from the API
        message = payloadError;
        if (payloadDetail) {
          message = `${message} (${payloadDetail})`;
        }
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json();
}

export async function putJson(url, body) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `When fetching ${url}, the response was [${res.status}] ${res.statusText}`;
    try {
      const payload = await res.json();
      const payloadError =
        typeof payload?.error === "string" ? payload.error : null;
      if (payloadError) {
        message = `${message}: ${payloadError}`;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json();
}

export async function deleteJson(url) {
  const res = await fetch(url, {
    method: "DELETE",
  });
  if (!res.ok) {
    let message = `When fetching ${url}, the response was [${res.status}] ${res.statusText}`;
    try {
      const payload = await res.json();
      const payloadError =
        typeof payload?.error === "string" ? payload.error : null;
      if (payloadError) {
        message = `${message}: ${payloadError}`;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  // Some DELETE endpoints might return 204 No Content
  if (res.status === 204) {
    return {};
  }
  return res.json();
}
