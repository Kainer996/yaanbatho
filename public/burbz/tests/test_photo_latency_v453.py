"""The synchronous photo flow must leave time for both independent views."""
import json
from test_photo_budget_v410 import ledger, jpeg, Provider
from test_photo_silhouette_v452 import raven
import photo_gemini


def test_one_view_gets_medium_thinking_inside_the_deadline(ledger):
    # v486 replaced the two low-thinking views with one medium view: the
    # player confirms the bird, so the time goes to looking harder once.
    book, _ = ledger
    provider = Provider(raven())
    result = photo_gemini.Recognizer(book, provider).identify(
        jpeg(), 'latency_owner_012345', 'latency_request_012345', 'caller')
    calls = [body for action, body in provider.calls if action == 'generateContent']
    assert result['found'] and len(calls) == 1
    assert calls[0]['generationConfig']['thinkingConfig'] == {'thinkingLevel': 'medium', 'includeThoughts': False}
    assert calls[0]['generationConfig']['maxOutputTokens'] == 8192


def test_response_socket_uses_remaining_absolute_deadline_not_20_second_cap(monkeypatch):
    timeouts = []
    class Socket:
        def settimeout(self, timeout): timeouts.append(timeout)
        def shutdown(self, _): pass
    class Response:
        status = 200
        def read(self, _): return json.dumps({'totalTokens': 2}).encode()
    class Connection:
        sock = Socket()
        def connect(self): pass
        def request(self, *args, **kwargs): pass
        def getresponse(self): return Response()
        def close(self): pass
    monkeypatch.setattr(photo_gemini.http.client, 'HTTPSConnection',
                        lambda *args, **kwargs: Connection())
    response = photo_gemini.Google('test-only').request('countTokens', {'contents': []}, 35)
    assert response == {'totalTokens': 2}
    assert len(timeouts) == 1 and 30 < timeouts[0] <= 35
