This is a token refresher for wewechat.
If wewechat is suspended, such as when the computer is in sleep or when wewechat
is quitted, tencent will revoke the login state after 5 mins (by observation).
This little program will help refreshing the login credential when wewechat is
offline. Currently needs dev branch of wewechat.

Since user's wechat credentials are needed in order to sync with wechat server,
this program is not intended to be deployed for public/general use. User should
use this on own discretion, and keep the program running environment safe. Also,
wide spread use of this tool will attract attention and likely get it banned.

You can run the program on http if you are drunk, or just want to deploy on
your own LAN, by not specifying USE_HTTP env and giving port number as the
first argument.
`npm start 8080`

Or ideally, you can deploy it on https. All you need to do is specifying
USE_HTTP, LE_EMAIL, and SERVER_NAME. It will handle all the https certificate
stuff for you.
`USE_HTTP=yes LE_EMAIL=noreply@youemail.com SERVER_NAME=yourdomain.com npm start`

I just don't trust tencent software.
