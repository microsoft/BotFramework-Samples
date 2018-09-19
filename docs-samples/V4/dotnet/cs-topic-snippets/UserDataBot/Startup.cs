﻿namespace UserDataBot
{
    using System;
    using System.Linq;
    using Microsoft.AspNetCore.Builder;
    using Microsoft.AspNetCore.Hosting;
    using Microsoft.Bot.Builder;
    using Microsoft.Bot.Builder.Azure;
    using Microsoft.Bot.Builder.BotFramework;
    using Microsoft.Bot.Builder.Dialogs;
    using Microsoft.Bot.Builder.Integration;
    using Microsoft.Bot.Builder.Integration.AspNet.Core;
    using Microsoft.Bot.Builder.TraceExtensions;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Options;

    public class Startup
    {
        // This method gets called by the runtime. Use this method to add services to the container.
        // For more information on how to configure your application, visit https://go.microsoft.com/fwlink/?LinkID=398940
        public Startup(IHostingEnvironment env)
        {
            var builder = new ConfigurationBuilder()
                .SetBasePath(env.ContentRootPath)
                .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
                .AddJsonFile($"appsettings.{env.EnvironmentName}.json", optional: true)
                .AddEnvironmentVariables();

            Configuration = builder.Build();
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            // Register your bot.
            services.AddBot<UserDataBot>(options =>
            {
                options.CredentialProvider = new ConfigurationCredentialProvider(Configuration);
                options.OnTurnError = async (context, exception) =>
                {
                    await context.TraceActivityAsync("Bot exception", exception);
                    await context.SendActivityAsync("Sorry, it looks like something went wrong!");
                };

                // Use persistent storage and create state management objects.
                var CosmosSettings = Configuration.GetSection("CosmosDB");
                IStorage storage = new CosmosDbStorage(
                    new CosmosDbStorageOptions
                    {
                        DatabaseId = CosmosSettings["DatabaseID"],
                        CollectionId = CosmosSettings["CollectionID"],
                        CosmosDBEndpoint = new Uri(CosmosSettings["EndpointUri"]),
                        AuthKey = CosmosSettings["AuthenticationKey"],
                    });
                options.State.Add(new ConversationState(storage));
                options.State.Add(new UserState(storage));
            });

            // Register the bot's state and state property accessor objects.
            services.AddSingleton<BotAccessors>(sp =>
            {
                var options = sp.GetRequiredService<IOptions<BotFrameworkOptions>>().Value;
                var userState = options.State.OfType<UserState>().FirstOrDefault();
                var conversationState = options.State.OfType<ConversationState>().FirstOrDefault();

                return new BotAccessors(userState, conversationState)
                {
                    UserDataAccessor = userState.CreateProperty<UserData>("UserDataBot.UserData"),
                    DialogStateAccessor = conversationState.CreateProperty<DialogState>("UserDataBot.DialogState"),
                };
            });
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            app.UseDefaultFiles()
                .UseStaticFiles()
                .UseBotFramework();
        }
    }
}