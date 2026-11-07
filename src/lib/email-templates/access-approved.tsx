import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import type { TemplateEntry } from './registry'

interface AccessApprovedProps {
  fullName?: string
  loginUrl?: string
}

export function AccessApprovedEmail({
  fullName = 'Hola',
  loginUrl = 'https://agendera.lovable.app/auth',
}: AccessApprovedProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Tu acceso a Agendera fue aprobado</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>¡Tu acceso fue aprobado! 🎉</Heading>
          <Text style={text}>Hola {fullName},</Text>
          <Text style={text}>
            Revisamos tu solicitud y ya tenés lugar en Agendera. Te enviamos también una
            invitación por email para crear tu contraseña y entrar por primera vez.
          </Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={loginUrl} style={button}>
              Ingresar a Agendera
            </Button>
          </Section>
          <Text style={text}>
            Cuando entres vas a poder configurar tus horarios, tus tipos de turno y dejar que la
            agenda se maneje sola.
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
const button = {
  backgroundColor: '#7E3F98',
  color: '#ffffff',
  borderRadius: '999px',
  padding: '12px 28px',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
}
const hr = { borderColor: '#eee5f0', margin: '28px 0 16px' }
const footer = { color: '#8b8194', fontSize: '12px', margin: 0 }

export const template = {
  component: AccessApprovedEmail,
  displayName: 'Acceso aprobado',
  subject: 'Tu acceso a Agendera fue aprobado',
  previewData: { fullName: 'Martina', loginUrl: 'https://agendera.lovable.app/auth' },
} satisfies TemplateEntry
