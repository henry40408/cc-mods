// The drawings that move. The pane is drawn again every second while a turn
// runs, and the app restarts a drawing whose source changed, so each source
// here is a constant: nothing that counts or tells the time goes into one.
import type { StepStatus } from '../../types'
import type { Status } from '../digest'
import type { Picture } from './icons'
import { HUES } from './palette'

const ORB_SIZE = 44
const NODE_SIZE = 20

type Art = { size: number; styles?: string; shapes: string }

// A person who asked their system for less motion gets the still drawing.
const STILL = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'

const svg = ({ size, styles, shapes }: Art): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
  `viewBox="0 0 ${size} ${size}" fill="none">` +
  (styles === undefined ? '' : `<style>${styles}${STILL}</style>`) +
  `${shapes}</svg>`

const WORKING_ORB = svg({
  size: ORB_SIZE,
  styles:
    '.arc{transform-origin:22px 22px;animation:turn 1.4s linear infinite}' +
    '.core{transform-origin:22px 22px;animation:beat 1.4s ease-in-out infinite}' +
    '@keyframes turn{to{transform:rotate(360deg)}}' +
    '@keyframes beat{50%{transform:scale(.7);opacity:.6}}',
  shapes:
    `<g stroke="${HUES.green}" stroke-width="4">` +
    '<circle cx="22" cy="22" r="18" stroke-opacity=".22"/>' +
    '<circle class="arc" cx="22" cy="22" r="18" stroke-linecap="round" ' +
    'stroke-dasharray="36 78"/></g>' +
    `<circle class="core" cx="22" cy="22" r="7" fill="${HUES.green}"/>`,
})

const WAITING_ORB = svg({
  size: ORB_SIZE,
  styles:
    '.wave{transform-origin:22px 22px;animation:spread 1.8s ease-out infinite}' +
    '.late{animation-delay:.9s}' +
    '@keyframes spread{from{transform:scale(.55);opacity:.7}' +
    'to{transform:scale(1);opacity:0}}',
  shapes:
    `<g fill="${HUES.amber}">` +
    '<circle class="wave" cx="22" cy="22" r="21" opacity=".25"/>' +
    '<circle class="wave late" cx="22" cy="22" r="21" opacity="0"/>' +
    '<circle cx="22" cy="22" r="12"/></g>' +
    '<path d="M22 15.5v8M22 28v.2" stroke="#fff" stroke-width="2.6" ' +
    'stroke-linecap="round"/>',
})

const IDLE_ORB = svg({
  size: ORB_SIZE,
  shapes:
    `<circle cx="22" cy="22" r="18" stroke="${HUES.gray}" stroke-width="4" ` +
    'stroke-opacity=".3"/>' +
    `<circle cx="22" cy="22" r="6" fill="${HUES.gray}" fill-opacity=".7"/>`,
})

const DONE_NODE = svg({
  size: NODE_SIZE,
  shapes:
    `<circle cx="10" cy="10" r="8" fill="${HUES.green}"/>` +
    '<path d="M6.6 10.3l2.3 2.3 4.5-4.9" stroke="#fff" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round"/>',
})

const CURRENT_NODE = svg({
  size: NODE_SIZE,
  styles:
    '.halo{transform-origin:10px 10px;animation:glow 1.6s ease-out infinite}' +
    '@keyframes glow{from{transform:scale(.5);opacity:.6}' +
    'to{transform:scale(1);opacity:0}}',
  shapes:
    `<circle class="halo" cx="10" cy="10" r="10" fill="${HUES.brand}" ` +
    'opacity=".3"/>' +
    `<circle cx="10" cy="10" r="6.5" stroke="${HUES.brand}" stroke-width="2"/>` +
    `<circle cx="10" cy="10" r="3" fill="${HUES.brand}"/>`,
})

const PENDING_NODE = svg({
  size: NODE_SIZE,
  shapes:
    `<circle cx="10" cy="10" r="6.5" stroke="${HUES.gray}" stroke-width="1.6" ` +
    'stroke-opacity=".6"/>',
})

export const STATUS_ORBS: Record<Status['kind'], Picture> = {
  working: {
    source: WORKING_ORB,
    alt: 'Working',
    size: ORB_SIZE,
    isAnimated: true,
  },
  waiting: {
    source: WAITING_ORB,
    alt: 'Waiting for you',
    size: ORB_SIZE,
    isAnimated: true,
  },
  idle: { source: IDLE_ORB, alt: 'Idle', size: ORB_SIZE },
}

export const STEP_NODES: Record<StepStatus, Picture> = {
  done: { source: DONE_NODE, alt: 'Done', size: NODE_SIZE },
  in_progress: {
    source: CURRENT_NODE,
    alt: 'In progress',
    size: NODE_SIZE,
    isAnimated: true,
  },
  pending: { source: PENDING_NODE, alt: 'Pending', size: NODE_SIZE },
}
