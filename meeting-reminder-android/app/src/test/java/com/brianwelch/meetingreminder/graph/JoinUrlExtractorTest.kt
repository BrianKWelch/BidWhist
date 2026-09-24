package com.brianwelch.meetingreminder.graph

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class JoinUrlExtractorTest {

    @Test fun zoomWithTrailingPunctuation() {
        assertEquals(
            "https://us02web.zoom.us/j/81234567890?pwd=xyz",
            JoinUrlExtractor.extract("Join here: https://us02web.zoom.us/j/81234567890?pwd=xyz."),
        )
    }

    @Test fun teamsInAngleBrackets() {
        val body = "Microsoft Teams meeting\nJoin: <https://teams.microsoft.com/l/meetup-join/19%3ameeting_x%40thread.v2/0?context=%7b%22Tid%22%7d>\nMeeting ID: 123"
        assertEquals(
            "https://teams.microsoft.com/l/meetup-join/19%3ameeting_x%40thread.v2/0?context=%7b%22Tid%22%7d",
            JoinUrlExtractor.extract(body),
        )
    }

    @Test fun safeLinksAreUnwrapped() {
        val wrapped = "https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Fzoom.us%2Fj%2F999%3Fpwd%3Dq&data=05%7C01&reserved=0"
        assertEquals("https://zoom.us/j/999?pwd=q", JoinUrlExtractor.extract("Link $wrapped"))
    }

    @Test fun ignoresNonMeetingLinks() {
        assertNull(JoinUrlExtractor.extract("Agenda https://contoso.sharepoint.com/sites/x/doc.docx and https://zoom.us/pricing"))
    }

    @Test fun firstTextWins() {
        assertEquals(
            "https://meet.google.com/abc-defg-hij",
            JoinUrlExtractor.extract(null, "https://meet.google.com/abc-defg-hij", "https://zoom.us/j/1"),
        )
    }

    @Test fun ampersandEntityDecoded() {
        assertEquals("https://zoom.us/j/1?pwd=a&uname=b", JoinUrlExtractor.extract("https://zoom.us/j/1?pwd=a&amp;uname=b"))
    }

    @Test fun recognisers() {
        assertTrue(JoinUrlExtractor.isMeetingUrl("https://teams.live.com/meet/9876"))
        assertTrue(JoinUrlExtractor.isMeetingUrl("https://dod.teams.microsoft.us/l/meetup-join/abc"))
        assertTrue(JoinUrlExtractor.isMeetingUrl("https://acme.webex.com/meet/pat"))
        assertFalse(JoinUrlExtractor.isMeetingUrl("https://teams.microsoft.com/"))
        assertFalse(JoinUrlExtractor.isMeetingUrl("ftp://zoom.us/j/1"))
        assertFalse(JoinUrlExtractor.isMeetingUrl("not a url"))
    }
}
