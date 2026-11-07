import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import * as React from 'react'
import type { TemplateEntry } from './registry'

interface AccessRejectedProps {
  fullName?: string
}

export function AccessRejectedEmail({ fullName = 'Hola' }: AccessRejectedProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Novedades sobre tu solicitud de acceso a Agendera</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Sobre tu solicitud de acceso</Heading>
          <Text style={text}>Hola {fullName},</Text>
          <Text style={text}>
            Gracias por tu interés en Agendera. Por ahora no podemos habilitar tu cuenta, así que
            tu solicitud quedó sin aprobar.
          </Text>
          <Text style={text}>
            Si creés que se trata de un error o querés contarnos más sobre tu actividad, podés
            responder este email y lo revisamos.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Agendera — La agenda que se maneja sola.</Text>
        </Container>
      </Body>
    </Html>
  )
}

const body = { backgroundColor: '#ffffff', fontFamily: 'DM Sans, Helvetica, Arial, sans-serif' }
const container = { margin: '0 auto', padding: '32px 24px', maxWidth: '560px' }
const h1 = { color: '#7E3F98', fontSize: '24px', fontWeight: 700, margin: '0 0 16px' }
const text = { color: '#2c2431', fontSize: '15px', lineHeight: '24px', margin: '0 0 12px' }
const hr = { borderColor: '#eee5f0', margin: '28px 0 16px' }
const footer = { color: '#8b8194', fontSize: '12px', margin: 0 }

export const template = {
  component: AccessRejectedEmail,
  displayName: 'Solicitud no aprobada',
  subject: 'Novedades sobre tu solicitud de acceso a Agendera',
  previewData: { fullName: 'Martina' },
} satisfies TemplateEntry
