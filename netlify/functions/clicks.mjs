import { getStore } from "@netlify/blobs";

const store = getStore("banana-clicker");

const KEY = "global-clicks";


// ========================================================
// OBTENER CLICKS ACTUALES
// ========================================================

async function getGlobalClicks() {

    const result = await store.getWithMetadata(
        KEY,
        {
            consistency: "strong"
        }
    );

    if (!result) {

        return {
            clicks: 0,
            etag: null
        };

    }

    return {
        clicks: Number(result.data) || 0,
        etag: result.etag
    };

}


// ========================================================
// GET
// Devuelve el contador global
// ========================================================

export default async function handler(request) {

    try {

        // ------------------------------------------------
        // GET
        // ------------------------------------------------

        if (request.method === "GET") {

            const data =
                await getGlobalClicks();

            return Response.json(
                {
                    globalClicks:
                        data.clicks
                },
                {
                    headers: {
                        "Cache-Control":
                            "no-store"
                    }
                }
            );

        }


        // ------------------------------------------------
        // POST
        // Suma exactamente 1 click
        // ------------------------------------------------

        if (request.method === "POST") {

            /*
             * Usamos ETag + onlyIfMatch.
             *
             * Si otra persona modifica el contador
             * mientras nosotros lo estamos actualizando,
             * la escritura falla y volvemos a intentarlo.
             */

            for (
                let attempt = 0;
                attempt < 10;
                attempt++
            ) {

                const current =
                    await getGlobalClicks();


                const next =
                    current.clicks + 1;


                // ----------------------------------------
                // Primera escritura
                // ----------------------------------------

                if (!current.etag) {

                    const result =
                        await store.set(
                            KEY,
                            String(next),
                            {
                                onlyIfNew: true
                            }
                        );


                    if (result.modified) {

                        return Response.json(
                            {
                                globalClicks:
                                    next
                            },
                            {
                                headers: {
                                    "Cache-Control":
                                        "no-store"
                                }
                            }
                        );

                    }


                    // Alguien creó el valor primero.
                    // Reintentamos.

                    continue;

                }


                // ----------------------------------------
                // Actualización con ETag
                // ----------------------------------------

                const result =
                    await store.set(
                        KEY,
                        String(next),
                        {
                            onlyIfMatch:
                                current.etag
                        }
                    );


                if (result.modified) {

                    return Response.json(
                        {
                            globalClicks:
                                next
                        },
                        {
                            headers: {
                                "Cache-Control":
                                    "no-store"
                            }
                        }
                    );

                }

                // Otro click ganó la carrera.
                // Volvemos a leer e intentamos otra vez.

            }


            return Response.json(
                {
                    error:
                        "No se pudo actualizar el contador."
                },
                {
                    status: 503
                }
            );

        }


        // ------------------------------------------------
        // MÉTODO NO PERMITIDO
        // ------------------------------------------------

        return new Response(
            "Method Not Allowed",
            {
                status: 405,
                headers: {
                    "Allow": "GET, POST"
                }
            }
        );


    } catch (error) {

        console.error(
            "Banana Clicker global error:",
            error
        );


        return Response.json(
            {
                error:
                    "Error interno del contador global."
            },
            {
                status:500
            }
        );

    }

}
