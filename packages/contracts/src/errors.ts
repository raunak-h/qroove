import { z } from 'zod';

export const ERROR_CODES = [
  'DUPLICATE',
  'QUOTA_FULL',
  'RULES_FROZEN',
  'NOT_OWNER',
  'ALREADY_STARTED',
  'EVENT_NOT_ACTIVE',
  'EVENT_ENDED',
  'STALE_LEASE',
  'STALE_VERSION',
  'UNSUPPORTED_LINK',
  'METADATA_UNAVAILABLE',
  'RATE_LIMITED',
  'UNAUTHORISED',
  'NOT_FOUND',
  'VALIDATION',
] as const;
export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

export interface ErrorCopy {
  message: string;
  /** The practical next action shown to the user (SPEC §6 unavailable states). */
  action: string;
  http: number;
}

export const ERROR_COPY: Record<ErrorCode, ErrorCopy> = {
  DUPLICATE: {
    message: 'This recording is already in tonight’s queue.',
    action: 'Pick a different song or version.',
    http: 409,
  },
  QUOTA_FULL: {
    message: 'You have used all your accepted songs for this event.',
    action: 'Remove a song that has not started to free a slot.',
    http: 409,
  },
  RULES_FROZEN: {
    message: 'The rules are locked once the event has started.',
    action: 'Create a new event to use different rules.',
    http: 409,
  },
  NOT_OWNER: {
    message: 'This request belongs to someone else.',
    action: 'You can only change your own requests.',
    http: 403,
  },
  ALREADY_STARTED: {
    message: 'This song has already started, so it cannot be changed.',
    action: 'Choose another song to request.',
    http: 409,
  },
  EVENT_NOT_ACTIVE: {
    message: 'The event is not accepting requests right now.',
    action: 'Wait for the organiser to start or resume the event.',
    http: 409,
  },
  EVENT_ENDED: {
    message: 'This event has ended.',
    action: 'Join the next event with a new link.',
    http: 410,
  },
  STALE_LEASE: {
    message: 'Another device is now controlling playback.',
    action: 'Reclaim the player if you are the DJ.',
    http: 409,
  },
  STALE_VERSION: {
    message: 'The event changed while you were acting.',
    action: 'Refresh and try again.',
    http: 409,
  },
  UNSUPPORTED_LINK: {
    message: 'That link is not from a supported service.',
    action: 'Paste a Spotify, YouTube or Apple Music link, or enter the song manually.',
    http: 422,
  },
  METADATA_UNAVAILABLE: {
    message: 'We could not look up that song.',
    action: 'Enter the title and artist manually.',
    http: 502,
  },
  RATE_LIMITED: {
    message: 'Too many attempts.',
    action: 'Wait a moment and try again.',
    http: 429,
  },
  UNAUTHORISED: {
    message: 'You do not have permission to do that.',
    action: 'Open the link you were given, or ask the organiser.',
    http: 401,
  },
  NOT_FOUND: {
    message: 'We could not find that.',
    action: 'Check the link or code and try again.',
    http: 404,
  },
  VALIDATION: {
    message: 'Some of the details are not valid.',
    action: 'Check the highlighted fields and try again.',
    http: 400,
  },
};

export const ApiError = z.object({
  error: z.object({ code: ErrorCode, message: z.string(), action: z.string() }),
});
export type ApiError = z.infer<typeof ApiError>;

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? ERROR_COPY[code].message);
    this.name = 'DomainError';
  }
  toBody(): ApiError {
    const c = ERROR_COPY[this.code];
    return { error: { code: this.code, message: this.message, action: c.action } };
  }
}
