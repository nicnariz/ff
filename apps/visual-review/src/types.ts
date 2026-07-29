export type ReviewStatus = 'PENDING' | 'APPROVED' | 'APPROVED_WITH_NOTES' | 'REJECTED';
export type ReviewerRole = 'QA' | 'PRODUCT_OWNER';

export interface Reviewer {
  name: string;
  role: ReviewerRole;
  at: string;
}

export interface Comment {
  id: string;
  author: string;
  role: ReviewerRole;
  message: string;
  createdAt: string;
}

export interface Review {
  key: string;
  captureHash: string;
  status: ReviewStatus;
  comment: string;
  comments: Comment[];
  qa: Reviewer | null;
  productOwner: Reviewer | null;
  reviewedAt: string | null;
}

export interface Capture {
  key: string;
  screen: string;
  device: string;
  platform: string;
  orientation: string;
  theme: string;
  resolution: { width: number; height: number };
  path: string;
  prototype: string;
  hash: string;
  capturedAt: string;
  status: string;
  version: string;
  candidateUrl: string;
  mockupUrl: string;
  review: Review;
}

export interface PortalData {
  version: string;
  build: string;
  baseline: string | null;
  readOnly: boolean;
  captures: Capture[];
}
