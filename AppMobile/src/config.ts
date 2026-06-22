// La URL del Directorio de Entornos (gals-registry). A diferencia de la URL
// de cada nodo (que el usuario tipea al vincular un entorno), esta es ÚNICA
// y compartida por toda la app — así que va hardcodeada aquí.
//
// OJO: como el túnel de Cloudflare del Registry es un "quick tunnel" (no uno
// fijo), la URL cambia cada vez que se reinicia el contenedor `gals-registry-tunnel`
// en la Raspberry Pi. Si el llavero deja de cargar entornos compartidos,
// lo primero a revisar es si esta URL sigue vigente
// (`docker compose logs gals-registry-tunnel` en el Pi).
export const REGISTRY_URL = 'https://registry-gals.juaniwilt.work';