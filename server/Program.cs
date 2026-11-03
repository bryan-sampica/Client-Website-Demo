using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var demo = builder.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("Demo:Enabled");
if (!demo) throw new InvalidOperationException("This local portfolio demo requires Development and Demo:Enabled=true. Configure real email and deployment security before production use.");
var data = Path.GetFullPath(builder.Configuration["DataDirectory"] ?? Path.Combine(builder.Environment.ContentRootPath, "App_Data"));
Directory.CreateDirectory(data);
if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(data, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(data, "keys")));
builder.Services.AddDbContext<Store>(o => o.UseSqlite($"Data Source={Path.Combine(data, "widgets.db")}"));
builder.Services.AddIdentity<User, IdentityRole>(o => { o.User.RequireUniqueEmail = true; o.Password.RequiredLength = 10; o.Lockout.MaxFailedAccessAttempts = 5; })
    .AddEntityFrameworkStores<Store>().AddDefaultTokenProviders();
builder.Services.ConfigureApplicationCookie(o => {
    o.Cookie.Name = "WidgetWorks.Session"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest; o.ExpireTimeSpan = TimeSpan.FromHours(2);
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(o => o.HeaderName = "X-XSRF-TOKEN");
builder.Services.AddSignalR(o => { o.MaximumReceiveMessageSize = 16 * 1024; o.EnableDetailedErrors = false; });
builder.Services.AddRateLimiter(o => {
    o.RejectionStatusCode = 429;
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(c => !c.Request.Path.StartsWithSegments("/api") && !c.Request.Path.StartsWithSegments("/hubs") ? RateLimitPartition.GetNoLimiter("static") : RateLimitPartition.GetFixedWindowLimiter(
        c.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? c.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
var app = builder.Build();
app.Use(async (ctx, next) => {
    if (ctx.Connection.RemoteIpAddress is { } ip && !System.Net.IPAddress.IsLoopback(ip)) { ctx.Response.StatusCode = 403; return; }
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["Referrer-Policy"] = "same-origin";
    ctx.Response.Headers["Content-Security-Policy"] = "default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
    if (ctx.Request.Path.StartsWithSegments("/api")) ctx.Response.Headers.CacheControl = "no-store";
    if (ctx.Request.Path.StartsWithSegments("/hubs") && ctx.Request.Headers.Origin.FirstOrDefault() is string origin &&
        origin != $"{ctx.Request.Scheme}://{ctx.Request.Host}") { ctx.Response.StatusCode = 403; return; }
    await next();
});
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.Use(async (ctx, next) => {
    if (ctx.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsHead(ctx.Request.Method)) {
        try { await ctx.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(ctx); }
        catch (AntiforgeryValidationException) { ctx.Response.StatusCode = 400; await ctx.Response.WriteAsJsonAsync(new { error = "Refresh the page and try again." }); return; }
    }
    await next();
});
app.MapGet("/api/health", () => new { status = "ok", mode = "local-demo" });
app.MapGet("/api/auth/csrf", (HttpContext c, IAntiforgery a) => {
    var token = a.GetAndStoreTokens(c); return Results.Ok(new { token = token.RequestToken });
});
app.MapPost("/api/auth/register", async (Credentials input, UserManager<User> users) => {
    if (!ValidEmail(input.Email) || (input.Password?.Length ?? 0) > 128 || string.IsNullOrEmpty(input.Password) || string.IsNullOrWhiteSpace(input.Name) || input.Name.Length > 80) return Error("Enter a valid name, email and password (10–128 characters).");
    var user = new User { UserName = input.Email.Trim(), Email = input.Email.Trim(), DisplayName = input.Name.Trim(), EmailConfirmed = true };
    var result = await users.CreateAsync(user, input.Password);
    return result.Succeeded ? Results.Ok(new { message = "Account created. You can sign in. Email verification is simulated in this local demo." }) : Error("Could not register. Use a new email and a password with uppercase, lowercase, a number and a symbol (at least 10 characters).");
});
app.MapPost("/api/auth/login", async (Credentials input, SignInManager<User> signIn) => {
    if (!ValidEmail(input.Email) || string.IsNullOrEmpty(input.Password) || input.Password.Length > 128) return Results.Json(new { error = "Sign-in failed." }, statusCode: 401);
    var result = await signIn.PasswordSignInAsync(input.Email.Trim(), input.Password, false, true);
    return result.Succeeded ? Results.Ok(new { message = "Signed in" }) : Results.Json(new { error = "Sign-in failed. Check your details or try later." }, statusCode: 401);
});
app.MapPost("/api/auth/logout", async (SignInManager<User> signIn) => { await signIn.SignOutAsync(); return Results.Ok(); }).RequireAuthorization();
app.MapGet("/api/auth/me", async (ClaimsPrincipal principal, UserManager<User> users) => {
    var user = await users.GetUserAsync(principal); return user is null ? Results.Unauthorized() : Results.Ok(new { user.Id, user.Email, user.DisplayName, roles = await users.GetRolesAsync(user) });
}).RequireAuthorization();
app.MapPost("/api/auth/forgot", async (Recovery input, UserManager<User> users) => {
    if (ValidEmail(input.Email)) {
        var user = await users.FindByEmailAsync(input.Email.Trim());
        if (user is not null) {
            var token = await users.GeneratePasswordResetTokenAsync(user);
            var link = "/account/reset?email=" + Uri.EscapeDataString(user.Email!) + "&token=" + Uri.EscapeDataString(token);
            await File.WriteAllTextAsync(Path.Combine(data, "latest-recovery.txt"), "LOCAL DEMO EMAIL ONLY\nTo: " + user.Email + "\nOpen on the local site: " + link);
            if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(Path.Combine(data, "latest-recovery.txt"), UnixFileMode.UserRead | UnixFileMode.UserWrite);
        }
    }
    return Results.Ok(new { message = "If the account exists, recovery instructions have been written to the local development mailbox (server/App_Data/latest-recovery.txt)." });
});
app.MapPost("/api/auth/reset", async (Recovery input, UserManager<User> users) => {
    var user = ValidEmail(input.Email) ? await users.FindByEmailAsync(input.Email.Trim()) : null;
    if (string.IsNullOrEmpty(input.Token) || user is null || (input.Password?.Length ?? 0) > 128 || string.IsNullOrEmpty(input.Password)) return Error("Invalid or expired recovery request.");
    var result = await users.ResetPasswordAsync(user, input.Token, input.Password);
    return result.Succeeded ? Results.Ok(new { message = "Password reset. Sign in with your new password." }) : Error("Invalid/expired link or password does not meet requirements.");
});
app.MapGet("/api/widgets", () => Catalog.Items);
app.MapGet("/api/news", async (Store db) => await db.Articles.Where(x => x.Published).OrderByDescending(x => x.PublishedAt).ToListAsync());
app.MapGet("/api/news/{slug}", async (string slug, Store db) => await db.Articles.FirstOrDefaultAsync(x => x.Slug == slug && x.Published) is { } article ? Results.Ok(article) : Results.NotFound());
app.MapGet("/api/staff/news", async (Store db) => await db.Articles.OrderByDescending(x => x.Id).ToListAsync()).RequireAuthorization(p => p.RequireRole("Editor"));
app.MapPost("/api/staff/news", async (ArticleInput input, Store db) => {
    if (string.IsNullOrWhiteSpace(input.Title) || input.Title.Length > 120 || string.IsNullOrWhiteSpace(input.Body) || input.Body.Length > 12000 || (input.Summary?.Length ?? 0) > 300) return Error("Supply a title, summary and article body within their limits.");
    var article = new Article { Title = input.Title.Trim(), Summary = input.Summary?.Trim() ?? "", Body = input.Body.Trim(), Slug = Guid.NewGuid().ToString("N")[..10], Published = input.Published, PublishedAt = DateTime.UtcNow };
    db.Articles.Add(article); await db.SaveChangesAsync(); return Results.Ok(article);
}).RequireAuthorization(p => p.RequireRole("Editor"));
app.MapPost("/api/staff/news/{id:int}/publish", async (int id, Store db, IHubContext<LiveHub> hub) => {
    var article = await db.Articles.FindAsync(id); if (article is null) return Results.NotFound();
    article.Published = true; article.PublishedAt = DateTime.UtcNow; await db.SaveChangesAsync();
    await hub.Clients.All.SendAsync("Toast", new { title = "Fresh from the workshop", message = article.Title });
    return Results.Ok(article);
}).RequireAuthorization(p => p.RequireRole("Editor"));
app.MapPost("/api/contact", async (ContactInput input, Store db) => {
    if (!ValidEmail(input.Email) || string.IsNullOrWhiteSpace(input.Name) || input.Name.Length > 80 || string.IsNullOrWhiteSpace(input.Message) || input.Message.Length > 4000) return Error("Enter a name, valid email and a message of up to 4,000 characters.");
    var item = new Contact { Name = input.Name.Trim(), Email = input.Email.Trim(), Message = input.Message.Trim() }; db.Contacts.Add(item); await db.SaveChangesAsync();
    return Results.Ok(new { message = "Message received by our demo support desk.", reference = item.Id });
});
app.MapGet("/api/staff/contacts", async (Store db) => await db.Contacts.OrderByDescending(x => x.Id).Take(100).ToListAsync()).RequireAuthorization(p => p.RequireRole("Support"));
app.MapPost("/api/exchanges", async (ExchangeInput input, ClaimsPrincipal user, Store db, IHubContext<LiveHub> hub) => {
    if (!Catalog.Items.Any(x => x.Slug == input.Widget) || string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Length > 1000) return Error("Choose a widget and describe the exchange.");
    var item = new Exchange { UserId = user.FindFirstValue(ClaimTypes.NameIdentifier)!, Widget = input.Widget, Reason = input.Reason.Trim() }; db.Exchanges.Add(item); await db.SaveChangesAsync();
    await hub.Clients.User(item.UserId).SendAsync("Toast", new { title = "Exchange received", message = $"Request #{item.Id} is now with the workshop." });
    return Results.Ok(item);
}).RequireAuthorization();
app.MapGet("/api/exchanges", async (ClaimsPrincipal user, Store db) => await db.Exchanges.Where(x => x.UserId == user.FindFirstValue(ClaimTypes.NameIdentifier)).ToListAsync()).RequireAuthorization();
app.MapPost("/api/notifications/demo", async (ClaimsPrincipal user, IHubContext<LiveHub> hub) => {
    await hub.Clients.User(user.FindFirstValue(ClaimTypes.NameIdentifier)!).SendAsync("Toast", new { title = "Dispatch from the workshop", message = "Your widget is ready. This notification travelled through the .NET SignalR hub." });
    return Results.Ok();
}).RequireAuthorization();
app.MapPost("/api/conversations", async (ClaimsPrincipal user, Store db) => {
    var id = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
    var thread = await db.Conversations.FirstOrDefaultAsync(x => x.CustomerId == id);
    if (thread is null) { thread = new Conversation { CustomerId = id }; db.Conversations.Add(thread); await db.SaveChangesAsync(); }
    return Results.Ok(thread);
}).RequireAuthorization();
app.MapGet("/api/conversations", async (ClaimsPrincipal user, Store db) => {
    var id = user.FindFirstValue(ClaimTypes.NameIdentifier);
    return await db.Conversations.Where(x => user.IsInRole("Support") || x.CustomerId == id).OrderByDescending(x => x.Id)
        .Select(x => new { x.Id, x.CustomerId, customerName = db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.DisplayName).FirstOrDefault() }).ToListAsync();
}).RequireAuthorization();
app.MapGet("/api/conversations/{id:int}/messages", async (int id, ClaimsPrincipal user, Store db) => {
    if (!await Access.CanChat(db, user, id)) return Results.NotFound();
    return Results.Ok(await db.Messages.Where(x => x.ConversationId == id).OrderByDescending(x => x.Id).Take(200).OrderBy(x => x.Id).ToListAsync());
}).RequireAuthorization();
app.MapHub<LiveHub>("/hubs/live", o => o.CloseOnAuthenticationExpiration = true).RequireAuthorization();
app.UseDefaultFiles(); app.UseStaticFiles();
app.MapFallbackToFile("index.html");
using (var scope = app.Services.CreateScope()) {
    var db = scope.ServiceProvider.GetRequiredService<Store>(); await db.Database.EnsureCreatedAsync();
    if (!await db.Articles.AnyAsync()) {
        db.Articles.AddRange(new Article { Slug = "meet-the-orbit", Title = "Meet Orbit. A little more possibility.", Summary = "Our fictional modular widget gets a quieter bearing and a brighter outlook.", Body = "Orbit is our everyday problem-solver: a modular widget built around one simple idea — useful things should be a pleasure to use.\n\nThe new edition pairs a replaceable core with a tactile adjustment ring. Swap a part, keep the rest, and get back to making.\n\nThis is illustrative product content for the Framework Theory portfolio demonstration. No physical products are offered for sale.", Published = true }, new Article { Slug = "second-life", Title = "Good widgets deserve a second act.", Summary = "Inside the Widget Works exchange programme.", Body = "A scratch is a story, not the end. Our fictional exchange programme lets customers describe an existing widget and request a workshop assessment.\n\nSubmit an exchange request in your account to see a real database record and a live notification. No shipment or payment is taken.", Published = true });
        await db.SaveChangesAsync();
    }
    var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    foreach (var role in new[] { "Support", "Editor" }) if (!await roles.RoleExistsAsync(role)) await roles.CreateAsync(new IdentityRole(role));
    var users = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
    if (await users.FindByEmailAsync("staff@widget.local") is null) {
        var password = "Ww!" + Convert.ToHexString(RandomNumberGenerator.GetBytes(12)) + "a";
        var staff = new User { UserName = "staff@widget.local", Email = "staff@widget.local", DisplayName = "Workshop team", EmailConfirmed = true };
        var created = await users.CreateAsync(staff, password); if (!created.Succeeded) throw new Exception("Demo staff setup failed");
        await users.AddToRolesAsync(staff, ["Support", "Editor"]);
        var file = Path.Combine(data, "staff-credentials.txt"); await File.WriteAllTextAsync(file, "Local demo staff\nEmail: staff@widget.local\nPassword: " + password + "\n");
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(file, UnixFileMode.UserRead | UnixFileMode.UserWrite);
    }
}
app.Run();
static bool ValidEmail(string? value) => !string.IsNullOrWhiteSpace(value) && value.Length <= 254 && new EmailAddressAttribute().IsValid(value);
static IResult Error(string message) => Results.BadRequest(new { error = message });

public class User : IdentityUser { public string DisplayName { get; set; } = ""; }
public class Store(DbContextOptions<Store> options) : IdentityDbContext<User>(options) {
    public DbSet<Article> Articles => Set<Article>(); public DbSet<Contact> Contacts => Set<Contact>();
    public DbSet<Conversation> Conversations => Set<Conversation>(); public DbSet<ChatMessage> Messages => Set<ChatMessage>(); public DbSet<Exchange> Exchanges => Set<Exchange>();
    protected override void OnModelCreating(ModelBuilder b) { base.OnModelCreating(b); b.Entity<Article>().HasIndex(x => x.Slug).IsUnique(); b.Entity<Conversation>().HasIndex(x => x.CustomerId).IsUnique(); }
}
public class Article { public int Id { get; set; } public string Slug { get; set; } = ""; public string Title { get; set; } = ""; public string Summary { get; set; } = ""; public string Body { get; set; } = ""; public bool Published { get; set; } public DateTime PublishedAt { get; set; } = DateTime.UtcNow; }
public class Contact { public int Id { get; set; } public string Name { get; set; } = ""; public string Email { get; set; } = ""; public string Message { get; set; } = ""; }
public class Exchange { public int Id { get; set; } public string UserId { get; set; } = ""; public string Widget { get; set; } = ""; public string Reason { get; set; } = ""; public string Status { get; set; } = "Awaiting workshop assessment"; }
public class Conversation { public int Id { get; set; } public string CustomerId { get; set; } = ""; }
public class ChatMessage { public int Id { get; set; } public int ConversationId { get; set; } public string SenderId { get; set; } = ""; public string SenderName { get; set; } = ""; public string Text { get; set; } = ""; public DateTime SentAt { get; set; } = DateTime.UtcNow; }
public record Credentials(string Email, string Password, string Name = "");
public record Recovery(string Email, string Token = "", string Password = "");
public record ContactInput(string Name, string Email, string Message);
public record ExchangeInput(string Widget, string Reason);
public record ArticleInput(string Title, string Summary, string Body, bool Published);
public static class Access {
    public static Task<bool> CanChat(Store db, ClaimsPrincipal user, int id) => db.Conversations.AnyAsync(x => x.Id == id && (user.IsInRole("Support") || x.CustomerId == user.FindFirstValue(ClaimTypes.NameIdentifier)));
}
public class LiveHub(Store db, UserManager<User> users) : Hub {
    public async Task Join(int conversationId) {
        if (!await Access.CanChat(db, Context.User!, conversationId)) throw new HubException("Conversation unavailable.");
        await Groups.AddToGroupAsync(Context.ConnectionId, $"chat:{conversationId}");
    }
    public async Task Send(int conversationId, string text) {
        if (!await Access.CanChat(db, Context.User!, conversationId)) throw new HubException("Conversation unavailable.");
        if (!ChatRules.IsValidMessage(text)) throw new HubException("Messages must be 1–2,000 characters.");
        var user = await users.GetUserAsync(Context.User!); if (user is null) throw new HubException("Sign in again.");
        var message = new ChatMessage { ConversationId = conversationId, SenderId = user.Id, SenderName = user.DisplayName, Text = text.Trim() };
        db.Messages.Add(message); await db.SaveChangesAsync();
        await Clients.Group($"chat:{conversationId}").SendAsync("Message", message);
        var thread = await db.Conversations.FindAsync(conversationId);
        if (thread!.CustomerId != user.Id) await Clients.User(thread.CustomerId).SendAsync("Toast", new { title = "The workshop replied", message = "There is a new message in your support conversation." });
    }
}
public record Widget(string Slug, string Name, string Tag, int Price, string Description, string Color);
public static class Catalog {
    public static readonly Widget[] Items = [new("orbit", "Orbit", "THE EVERYDAY ORIGINAL", 49, "A beautifully balanced all-rounder. Small enough for your desk. Ready for your next big idea.", "orange"), new("relay", "Relay", "MADE TO CONNECT", 79, "Bring your parts together with a modular connector that makes complex feel simple.", "green"), new("nova", "Nova", "A LITTLE EXTRA POWER", 129, "Precision where it matters, with a replaceable core and room to grow.", "purple")];
}

public static class ChatRules { public static bool IsValidMessage(string? text) => !string.IsNullOrWhiteSpace(text) && text.Length <= 2000; }
