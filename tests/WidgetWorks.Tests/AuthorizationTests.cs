using System.Security.Claims;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace WidgetWorks.Tests;
public class AuthorizationTests {
    static ClaimsPrincipal Principal(string id, string? role = null) {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, id) };
        if (role is not null) claims.Add(new(ClaimTypes.Role, role));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
    }
    [Theory]
    [InlineData("customer-a", null, 1, true)]
    [InlineData("customer-b", null, 1, false)]
    [InlineData("editor", "Editor", 1, false)]
    [InlineData("agent", "Support", 1, true)]
    [InlineData("agent", "Support", 999, false)]
    public async Task Conversation_access_respects_ownership_and_support_role(string user, string? role, int id, bool expected) {
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using var db = new Store(new DbContextOptionsBuilder<Store>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        db.Conversations.Add(new Conversation { Id = 1, CustomerId = "customer-a" }); await db.SaveChangesAsync();
        Assert.Equal(expected, await Access.CanChat(db, Principal(user, role), id));
    }
    [Theory]
    [InlineData(null, false)] [InlineData("", false)] [InlineData("   ", false)] [InlineData("Hello workshop", true)]
    public void Chat_rejects_empty_messages(string? text, bool expected) => Assert.Equal(expected, ChatRules.IsValidMessage(text));
    [Fact] public void Chat_enforces_payload_boundary() { Assert.True(ChatRules.IsValidMessage(new string('a', 2000))); Assert.False(ChatRules.IsValidMessage(new string('a', 2001))); }
}
