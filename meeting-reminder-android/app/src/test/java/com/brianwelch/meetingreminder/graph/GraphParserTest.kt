package com.brianwelch.meetingreminder.graph

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class GraphParserTest {

    private val page = """
    {
      "@odata.context": "https://graph.microsoft.com/v1.0/${'$'}metadata#users('x')/calendarView",
      "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/calendarView?skip=100",
      "value": [
        {
          "id": "AAMkTeams",
          "subject": "Project COBRA Weekly Touchpoint",
          "isAllDay": false,
          "isCancelled": false,
          "start": {"dateTime": "2026-09-25T14:00:00.0000000", "timeZone": "UTC"},
          "end":   {"dateTime": "2026-09-25T14:30:00.0000000", "timeZone": "UTC"},
          "onlineMeeting": {"joinUrl": "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d"},
          "location": {"displayName": "Microsoft Teams Meeting"},
          "organizer": {"emailAddress": {"name": "Pat Doe", "address": "pat@example.com"}},
          "responseStatus": {"response": "accepted"}
        },
        {
          "id": "AAMkZoom",
          "subject": "Budget review",
          "start": {"dateTime": "2026-09-25T18:00:00.0000000", "timeZone": "UTC"},
          "end":   {"dateTime": "2026-09-25T19:00:00.0000000", "timeZone": "UTC"},
          "onlineMeeting": null,
          "location": {"displayName": "Conference Room 4"},
          "body": {"contentType": "text", "content": "Join Zoom Meeting\r\n<https://agency.zoomgov.com/j/1601234567?pwd=abc> \r\nMeeting ID: 160 123 4567"}
        },
        {
          "id": "AAMkPlain",
          "subject": "",
          "start": {"dateTime": "2026-09-26T09:00:00", "timeZone": "Eastern Standard Time"},
          "end":   {"dateTime": "2026-09-26T09:30:00", "timeZone": "Eastern Standard Time"},
          "isCancelled": true,
          "responseStatus": {"response": "declined"}
        },
        { "subject": "no id, skipped" }
      ]
    }
    """.trimIndent()

    @Test fun parsesPageAndNextLink() {
        val p = GraphParser.parsePage(page)
        assertEquals(3, p.meetings.size)
        assertEquals("https://graph.microsoft.com/v1.0/me/calendarView?skip=100", p.nextLink)
    }

    @Test fun teamsMeeting() {
        val m = GraphParser.parsePage(page).meetings[0]
        assertEquals("Project COBRA Weekly Touchpoint", m.title)
        assertEquals(Instant.parse("2026-09-25T14:00:00Z"), m.start)
        assertEquals(Instant.parse("2026-09-25T14:30:00Z"), m.end)
        assertTrue(m.joinUrl!!.startsWith("https://teams.microsoft.com/l/meetup-join/"))
        assertEquals("Pat Doe", m.organizer)
        assertFalse(m.isDeclined)
    }

    @Test fun zoomLinkFoundInBody() {
        val m = GraphParser.parsePage(page).meetings[1]
        assertEquals("https://agency.zoomgov.com/j/1601234567?pwd=abc", m.joinUrl)
        assertEquals("Conference Room 4", m.location)
    }

    @Test fun windowsZoneNameAndBlankSubject() {
        val m = GraphParser.parsePage(page).meetings[2]
        assertEquals("(No title)", m.title)
        // 09:00 Eastern Daylight Time = 13:00 UTC
        assertEquals(Instant.parse("2026-09-26T13:00:00Z"), m.start)
        assertTrue(m.isCancelled)
        assertTrue(m.isDeclined)
        assertNull(m.joinUrl)
    }

    @Test fun ianaZoneAndLongFraction() {
        val json = """{"dateTime":"2026-11-01T01:30:00.1234567891","timeZone":"America/New_York"}"""
        val i = GraphParser.parseDateTime(org.json.JSONObject(json))
        // 2026-11-01 01:30 in New York is ambiguous (DST ends); java.time picks the earlier offset (EDT, -4).
        assertEquals(Instant.parse("2026-11-01T05:30:00.123456789Z"), i)
    }

    @Test fun emptyPage() {
        val p = GraphParser.parsePage("""{"value":[]}""")
        assertTrue(p.meetings.isEmpty())
        assertNull(p.nextLink)
    }
}
