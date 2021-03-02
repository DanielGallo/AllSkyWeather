# Allsky Weather

A script that outputs local weather information to a text file, for use with an [Allsky](https://github.com/thomasjacquin/allsky) camera to display local weather conditions in Allsky images.

This script uses the [OpenWeatherMap API](https://openweathermap.org/api) - a free API key needs to be generated in order to use this script.

## Example usage

On the machine or device where you need to use this script, do the following:

1. Download the contents of this repository into a new folder
2. Install Node.js
3. Run `npm install` to install the required packages
4. Test the script by running the command below, or add a Cron job or scheduled task that calls the script at a set interval, in order to generate the text file with fresh data:
  
  `node index.js --output=/home/pi/allskyweather/weather.txt --key=YOUR_API_KEY --city=London --region=Europe/London`

## Arguments

- `--output` - The full path where to generate the text file
- `--key` - Your API key for the OpenWeatherMap API service (please note: API keys take a few minutes before they become active after creation)
- `--city` - The location you want to generate weather information
- `--region` - This is the timezone region for generating the correct local sunrise and sunset times. For valid values, refer to the [date-fns-tz](https://www.npmjs.com/package/date-fns-tz) package

## Adding the text to Allsky images

Update the `settings_ZWO.json` file in your Allsky folder by adding the location of the `extratext` file:

`"extratext":"/home/pi/allskyweather/weather.txt"`
