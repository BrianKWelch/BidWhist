package com.brianwelch.meetingreminder.auth

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthConfigTest {

    private val pkg = "com.brianwelch.meetingreminder"
    private val hash = "2pmj9i4rSx0yEb/viWBYkE/ZQrk="
    private val clientId = "11111111-2222-3333-4444-555555555555"

    @Test fun redirectUriUrlEncodesHash() {
        assertEquals("msauth://$pkg/2pmj9i4rSx0yEb%2FviWBYkE%2FZQrk%3D", AuthConfig.redirectUri(pkg, hash))
    }

    @Test fun singleTenantConfig() {
        val o = JSONObject(AuthConfig.json(clientId, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", pkg, hash))
        assertEquals(clientId, o.getString("client_id"))
        assertEquals("SINGLE", o.getString("account_mode"))
        val audience = o.getJSONArray("authorities").getJSONObject(0).getJSONObject("audience")
        assertEquals("AzureADMyOrg", audience.getString("type"))
        assertEquals("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", audience.getString("tenant_id"))
    }

    @Test fun blankTenantMeansAnyWorkAccount() {
        val o = JSONObject(AuthConfig.json(clientId, "", pkg, hash))
        val audience = o.getJSONArray("authorities").getJSONObject(0).getJSONObject("audience")
        assertEquals("AzureADMultipleOrgs", audience.getString("type"))
    }

    @Test fun onlyReadScopeRequested() {
        assertEquals(listOf("https://graph.microsoft.com/Calendars.Read"), AuthConfig.SCOPES)
        assertTrue(AuthConfig.SCOPES.none { it.contains("ReadWrite", ignoreCase = true) })
    }

    @Test fun validation() {
        assertTrue(AuthConfig.isValidClientId(" $clientId "))
        assertFalse(AuthConfig.isValidClientId("my-app"))
        assertTrue(AuthConfig.isValidTenant(""))
        assertTrue(AuthConfig.isValidTenant("contoso.onmicrosoft.com"))
        assertTrue(AuthConfig.isValidTenant("organizations"))
        assertFalse(AuthConfig.isValidTenant("not a tenant"))
    }
}
