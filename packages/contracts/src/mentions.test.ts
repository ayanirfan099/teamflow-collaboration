import { describe, expect, it } from 'vitest';
import { buildMention, encodeMentions, parseMentions, renderMentionMarkup } from './mentions';

// The markup only accepts a UUID as the user id.
const ada = { name: 'Ada Lovelace', userId: '11111111-1111-4111-8111-111111111111' };
const ann = { name: 'Ann', userId: '22222222-2222-4222-8222-222222222222' };
const anna = { name: 'Anna', userId: '33333333-3333-4333-8333-333333333333' };

describe('the mention markup', () => {
  it('builds a markup that contains the name and the id', () => {
    expect(buildMention('Ada Lovelace', ada.userId)).toBe(`@[Ada Lovelace](user:${ada.userId})`);
  });

  it('reads the mentioned users out of a body', () => {
    const body = `Hello @[Ada Lovelace](user:${ada.userId}), look at this.`;

    const mentions = parseMentions(body);

    expect(mentions).toHaveLength(1);
    expect(mentions[0]?.id).toBe(ada.userId);
    expect(mentions[0]?.name).toBe('Ada Lovelace');
  });

  it('counts a mentioned user only once', () => {
    const body = `@[Ada Lovelace](user:${ada.userId}) and again @[Ada Lovelace](user:${ada.userId})`;

    expect(parseMentions(body)).toHaveLength(1);
  });

  it('renders the markup as readable text', () => {
    expect(renderMentionMarkup(`Hi @[Ada Lovelace](user:${ada.userId})!`)).toBe(
      'Hi @Ada Lovelace!',
    );
  });

  it('encodes a readable name back into the markup', () => {
    expect(encodeMentions('Hi @Ada Lovelace!', [ada])).toBe(
      `Hi @[Ada Lovelace](user:${ada.userId})!`,
    );
  });

  it('replaces the longest name first', () => {
    // "@Ann" must not swallow the beginning of "@Anna".
    expect(encodeMentions('Hello @Anna and @Ann', [ann, anna])).toBe(
      `Hello @[Anna](user:${anna.userId}) and @[Ann](user:${ann.userId})`,
    );
  });

  it('leaves a body without a mention untouched', () => {
    expect(encodeMentions('Nothing to see here', [ada])).toBe('Nothing to see here');
  });

  it('does not encode a name twice', () => {
    const encoded = encodeMentions('Hi @Ada Lovelace', [ada]);

    expect(encodeMentions(encoded, [ada])).toBe(encoded);
  });
});
