import { AtpAgent } from '@atproto/api';

const COLLECTION_DOC = 'site.standard.document';
const COLLECTION_PUB = 'site.standard.publication';

export async function createAgent(pdsUrl, handle, appPassword) {
  const agent = new AtpAgent({ service: pdsUrl });
  await agent.login({ identifier: handle, password: appPassword });
  return agent;
}

/** Returns the AT URI of the publication record: at://did/site.standard.publication/self */
export function publicationUri(did) {
  return `at://${did}/${COLLECTION_PUB}/self`;
}

export async function putDocument(agent, slug, record) {
  const result = await agent.com.atproto.repo.putRecord({
    repo: agent.session.did,
    collection: COLLECTION_DOC,
    rkey: slug,
    record,
    validate: false, // client doesn't have site.standard.* lexicons locally
  });
  return result.data.uri;
}

export async function deleteDocument(agent, slug) {
  await agent.com.atproto.repo.deleteRecord({
    repo: agent.session.did,
    collection: COLLECTION_DOC,
    rkey: slug,
  });
}

export async function putPublication(agent, record) {
  const result = await agent.com.atproto.repo.putRecord({
    repo: agent.session.did,
    collection: COLLECTION_PUB,
    rkey: 'self',
    record: { $type: COLLECTION_PUB, ...record },
    validate: false,
  });
  return result.data.uri;
}
