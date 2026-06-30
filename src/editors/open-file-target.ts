type UriLike = {
  toString(): string;
};

type ChangeTabName = 'proposal' | 'design' | 'tasks' | 'specs';

export type OpenFileTargetDocument =
  | {
      readonly selectedTab: ChangeTabName;
      readonly proposal?: { readonly uri: UriLike };
      readonly design?: { readonly uri: UriLike };
      readonly tasks?: { readonly uri: UriLike };
      readonly selectedSpecUri?: UriLike;
      readonly specs: readonly { readonly uri: UriLike }[];
    }
  | {
      readonly kind: string;
      readonly uri: UriLike;
    };

export function resolveOpenFileUri(document: OpenFileTargetDocument): string | undefined {
  if ('uri' in document) {
    return document.uri.toString();
  }

  switch (document.selectedTab) {
    case 'proposal':
      return document.proposal?.uri.toString();
    case 'design':
      return document.design?.uri.toString();
    case 'tasks':
      return document.tasks?.uri.toString();
    case 'specs':
      return document.selectedSpecUri?.toString() ?? document.specs[0]?.uri.toString();
    default:
      return undefined;
  }
}
