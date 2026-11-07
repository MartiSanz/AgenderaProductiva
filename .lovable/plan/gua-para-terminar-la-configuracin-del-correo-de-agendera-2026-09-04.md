# Guía para terminar la configuración del correo de Agendera

## Situación actual

Los cuatro registros aparecen cargados en Cloudflare, pero `agendera.com` todavía figura como **Pending**. Al comprobarlos desde Internet, los registros de correo aún no aparecen públicamente. Por eso Lovable todavía muestra `noreply.agendera.com` como pendiente.

No borres ni vuelvas a crear los registros que ya aparecen en la captura.

## Paso 1 — Activar el dominio en Cloudflare

1. En Cloudflare, hacé clic en **Overview** en el menú lateral izquierdo.
2. Buscá una sección que diga **Pending Nameserver Update**, **Complete your nameserver setup** o **Change your nameservers**.
3. Cloudflare te mostrará dos servidores de nombres asignados al dominio.
4. Comparalos con estos, que son los que Internet muestra actualmente para `agendera.com`:
   - `gannon.ns.cloudflare.com`
   - `rayne.ns.cloudflare.com`
5. Si Cloudflare muestra exactamente esos dos:
   - No cambies nada en el registrador.
   - Pulsá **Check nameservers now**, **Re-check now** o **Done, check nameservers**.
6. Si Cloudflare muestra dos nombres diferentes:
   - Entrá al sitio donde compraste `agendera.com`.
   - Buscá **Nameservers**, **Servidores DNS** o **DNS servers**.
   - Reemplazá los actuales por los dos que Cloudflare muestra en **Overview**.
   - No agregues registros A, TXT o NS en esa pantalla: allí solamente van los dos servidores generales de Cloudflare.
   - Guardá y volvé a Cloudflare para pulsar **Check nameservers now**.
7. Esperá hasta que el aviso amarillo desaparezca y el estado del dominio diga **Active**. Puede tardar desde algunos minutos hasta 24 horas; en casos excepcionales, hasta 72 horas.

## Paso 2 — Revisar los registros de correo

Cuando Cloudflare indique **Active**, volvé a **DNS → Records** y comprobá que sigan estos registros:

| Tipo | Nombre | Contenido |
|---|---|---|
| NS | `noreply` | `ns3.lovable.cloud` |
| NS | `noreply` | `ns4.lovable.cloud` |
| TXT | `_lovable-email` | `lovable_email_verify=4b6478cd13073e76c8af79b95bf8a48f01c22a7e47083c27c8ea31ceedffa64f` |
| TXT | `_dmarc` | El valor de DMARC que ya aparece en la captura |

En Cloudflare es normal que la tabla muestre los nombres completos, como `noreply.agendera.com`.

Importante:
- Los dos NS deben quedar como **DNS only**.
- No debe existir un registro A, AAAA, CNAME o MX adicional llamado `noreply`.
- Las comillas que Cloudflare muestra alrededor de los valores TXT son normales.
- No cambies el TTL; **Auto** está bien.

## Paso 3 — Verificar el correo en Lovable

1. Una vez que Cloudflare muestre el dominio como **Active**, abrí el proyecto de Agendera.
2. Entrá en **Cloud → Emails**.
3. Abrí **Manage Domains**.
4. Seleccioná `noreply.agendera.com`.
5. Pulsá **Verify Domain**.
6. El objetivo es que el estado cambie de **Setting up / Verifying your domain** a **Active**.

Si sigue pendiente inmediatamente después, no vuelvas a modificar los registros: esperá la propagación y repetí **Verify Domain** más tarde.

## Paso 4 — Comprobación final

Cuando el estado del correo aparezca como **Active**, volveremos a comprobarlo desde aquí. Después quedará implementar y probar el correo automático al paciente con:

- datos del turno;
- dirección del consultorio;
- botón **Agregar a Google Calendar**.

La advertencia de Cloudflare que dice que los visitantes no pueden llegar a `agendera.com` o `www.agendera.com` corresponde al sitio web, no al correo. No hace falta resolverla para verificar `noreply.agendera.com`.
