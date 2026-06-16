function buildUpstreamUrl(requestUrl, apiOrigin, pathValue) {
    const incomingUrl = new URL(requestUrl);
    const normalizedOrigin = apiOrigin.replace(/\/+$/, '');
    const upstreamUrl = new URL(`${normalizedOrigin}/api/${pathValue || ''}`);
    upstreamUrl.search = incomingUrl.search;
    return upstreamUrl;
}

function sanitizeProxyHeaders(request, upstreamUrl) {
    const headers = new Headers(request.headers);
    headers.set('x-forwarded-host', new URL(request.url).host);
    headers.set('x-forwarded-proto', new URL(request.url).protocol.replace(':', ''));
    headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '');
    headers.set('host', upstreamUrl.host);
    return headers;
}

export async function onRequest(context) {
    const { request, env, params } = context;
    const apiOrigin = (env.API_ORIGIN || '').trim();

    if (!apiOrigin) {
        return new Response(
            'Cloudflare Pages Functions: defina a variavel API_ORIGIN para encaminhar /api ao backend.',
            { status: 500 },
        );
    }

    const pathValue = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
    const upstreamUrl = buildUpstreamUrl(request.url, apiOrigin, pathValue);
    const headers = sanitizeProxyHeaders(request, upstreamUrl);

    const upstreamResponse = await fetch(upstreamUrl.toString(), {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'manual',
    });

    return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: upstreamResponse.headers,
    });
}
