# Plan: Terminar la configuración de DNS y correo de Agendera

## Situación actual

- El dominio `agendera.com` todavía no está verificado para enviar correos.
- Cloudflare te está pidiendo cambiar los "nameservers" (servidores de nombres) del dominio.
- Los registros que faltan son:
  - Un registro TXT `_lovable-email.agendera.com` para verificar que sos dueña del dominio.
  - Dos registros NS `noreply.agendera.com` para delegar el envío de correos a Lovable.

## Paso a paso

### 1. Cambiar los nameservers en el lugar donde compraste el dominio

Cloudflare te muestra esta pantalla porque los nameservers actuales de `agendera.com` son los viejos (`gannon.ns.cloudflare.com` y `rayne.ns.cloudflare.com`) y ahora te pide que uses los nuevos (`ashley.ns.cloudflare.com` y `buck.ns.cloudflare.com`).

**Importante:** esto no se cambia dentro de Cloudflare, sino en el sitio donde compraste el dominio (por ejemplo: Nic.ar, DonWeb, Namecheap, GoDaddy, etc.).

1. Entrá al panel de control de tu registrador de dominios (donde compraste `agendera.com`).
2. Buscá la sección "Nameservers", "Servidores de nombres" o "DNS".
3. Eliminá los nameservers viejos:
   - `gannon.ns.cloudflare.com`
   - `rayne.ns.cloudflare.com`
4. Agregá los nuevos que te da Cloudflare:
   - `ashley.ns.cloudflare.com`
   - `buck.ns.cloudflare.com`
5. Guardá los cambios.

Esto puede tardar entre unos minutos y 72 horas en propagarse por internet.

### 2. Agregar los registros de correo dentro de Cloudflare

Una vez que Cloudflare muestre que la zona está "Activa" (el mensaje de "Reemplazar nameservers" desaparece), tenés que agregar estos registros en la sección DNS de Cloudflare:

| Tipo | Nombre | Contenido |
|------|--------|-----------|
| TXT | `_lovable-email` | `lovable_email_verify=4b6478cd13073e76c8af79b95bf8a48f01c22a7e47083c27c8ea31ceedffa64f` |
| NS | `noreply` | `ns3.lovable.cloud` |
| NS | `noreply` | `ns4.lovable.cloud` |

**A tener en cuenta:**
- Los dos registros NS deben crearse por separado, no en el mismo campo.
- No actives el proxy naranja en los registros NS (deben quedar como "DNS only").
- Si ya existe algún registro A, CNAME o MX en `noreply.agendera.com`, borralo antes de agregar los NS.

### 3. Verificar que todo esté funcionando

Después de agregar los registros, avisame y vuelvo a revisar el estado. Cuando el dominio de correo pase a "active", ya podemos enviar mails desde `@agendera.com`.

### 4. Implementar el mail de confirmación de turno (una vez verificado el dominio)

Cuando el DNS esté listo, preparo:
- La plantilla de email que se envía al paciente cuando se agenda un turno.
- Un botón dentro del mail para que el paciente lo agregue a su Google Calendar.
- El disparo automático al crear el turno, solo si el paciente tiene email cargado.

## Preguntas para seguir sin asumir

1. ¿Dónde compraste el dominio `agendera.com`? (Nic.ar, DonWeb, Namecheap, GoDaddy, otro)
2. ¿Tenés acceso al panel de ese registrador para cambiar los nameservers?
3. ¿Querés que prepare la plantilla y el envío del mail de confirmación de turno ahora, para que se active sola apenas verifique el DNS?
