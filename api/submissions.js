import { createSubmissionDataHandler } from '../server/submissionHandlers.js';
import { createSubmissionWriteHandler } from '../server/listingMutationHandlers.js';

const readSubmissions = createSubmissionDataHandler();
const writeSubmission = createSubmissionWriteHandler();

export default function submissions(request, response) {
  return request.method === 'GET'
    ? readSubmissions(request, response)
    : writeSubmission(request, response);
}
