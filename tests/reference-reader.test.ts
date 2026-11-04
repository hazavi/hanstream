// @vitest-environment node
import { expect, it } from 'vitest';
import { parseReferenceDetail } from '../lib/reference-reader';
const html = '<div class="tbs-detail-title-txt"><em>Published Drama</em><span>Original title</span></div><div class="tv_program_image"><img src="/cover.jpg"></div><div class="tv_program_label">Broadcast Date</div><p>2026.10.13 -</p><div class="tv_program_label">Cast</div><p><a>First Actor</a><br><a>Second Actor</a></p><div class="tv_program_label">GENRE</div><ul><li>Romance</li></ul><div class="desc">The published English story.<hr>Translated duplicate.<p>More translation.</p></div>';
it('uses matching broadcaster metadata without mixing translations or other titles', () => {
  expect(parseReferenceDetail(html, 'https://reference.example/en/program/publisheddrama', 'published drama', 2026)).toMatchObject({ title: 'Published Drama', image: 'https://reference.example/cover.jpg', overview: 'The published English story.', cast: [{name:'First Actor'},{name:'Second Actor'}], genres:['Romance'], year:2026 });
  expect(parseReferenceDetail(html, 'https://reference.example/test', 'Different Drama', 2026)).toBeNull();
  expect(parseReferenceDetail(html, 'https://reference.example/test', 'Published Drama', 2020)).toBeNull();
});
