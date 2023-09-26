const twilio = require('./twilio');
const dialogflow = require('./dialogflow');

const MongoClient = require('mongodb').MongoClient;
// Connection URL
const dbUrl = 'mongodb://127.0.0.1:27017';
// Database Name
const dbName = 'AutosPlazaBBDD';

const { ObjectId } = require('mongodb');

async function executeQuery(query, collectionName) {
    thisClient = new MongoClient(dbUrl);

    try {
      await thisClient.connect();

      //console.log(query);

      const db = thisClient.db(dbName);
      const collection = db.collection(collectionName);

      return await collection.find(query).toArray();
    } catch (error) {
      console.error('Error:', error);
      throw error;
    } finally {
      thisClient.close();
    }
}

async function executeQueryFirst(query, collectionName) {
    thisClient = new MongoClient(dbUrl);
  
    try {
      await thisClient.connect();
  
      //console.log(query);
  
      const db = thisClient.db(dbName);
      const collection = db.collection(collectionName);
  
      return await collection.findOne(query);
    } catch (error) {
      console.error('Error:', error);
      throw error;
    } finally {
      thisClient.close();
    }
}
  
async function executeDelete(query, collectionName) {
    thisClient = new MongoClient(dbUrl);

    try {
        await thisClient.connect();

        const db = thisClient.db(dbName);
        const collection = db.collection(collectionName);

        return await collection.deleteOne(query);
    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        thisClient.close();
    }
}

async function sendByIntent(type, phone, lang, date){
    let message = '';
    switch(type){
        case 'confirm':
            const query = { intent: "askConfirmation" };
            const thisMessage = await executeQueryFirst(query, 'Responses');
            message = thisMessage["text"+lang];

            payload = await dialogflow.sendToDialogFlow("confirmBooking", phone);
            await twilio.sendTextMessage(phone, message);
        break;

        case 'return':
            message = '';
            let message3 = '';

            const formattedDate = formatDateToDayMonthYearHourMinute(date);

            switch(lang){
                case "es":
                    message = "Esperamos que haya disfrutado mucho en su viaje con Autosplaza. Recuerde que debe dejar el vehículo a el " + formattedDate.toString() + " en la siguiente ubicación.\n";
        
                    message3 = "Si necesita entregarlo en otro lugar, notifíquenoslo en el 922 383 433.";
                break;
        
                case "de":
                    message = "Esperamos que haya disfrutado mucho en su viaje con Autosplaza. Recuerde que debe dejar el vehículo a el " + formattedDate.toString() + " en la siguiente ubicación.\n";
        
                    message3 = "Si necesita entregarlo en otro lugar, notifíquenoslo en el 922 383 433.";
                break;
        
                default:
                    message = "Esperamos que haya disfrutado mucho en su viaje con Autosplaza. Recuerde que debe dejar el vehículo a el " + formattedDate.toString() + " en la siguiente ubicación.\n";
        
                    message3 = "Si necesita entregarlo en otro lugar, notifíquenoslo en el 922 383 433.";
                break;
            }

            await twilio.sendTextMessage(phone, message)
            await twilio.sendTextMessage(phone, message3)

        break;

        case 'rate':
            const query2 = { intent: "askRating" };
            const thisMessage2 = await executeQueryFirst(query2, 'Responses');
            message = thisMessage2["text"+lang];

            payload = await dialogflow.sendToDialogFlow("startRating", phone);
            await twilio.sendTextMessage(phone, message);
        break;
    }
}

function parseCustomDate(dateString) {
  const datePattern = /(\w{3}) (\w{3}) (\d{2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) (\w{3})([+-]\d{4}) \(([^)]+)\)/;
  const parts = dateString.match(datePattern);

  if (parts) {
    const [, day, month, dayNum, year, hour, minute, second, tz, offset, timeZone] = parts;
    const months = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    const monthNum = months[month];
    const utcOffset = parseInt(offset) / 100;

    const parsedDate = new Date(Date.UTC(year, monthNum, dayNum, hour, minute, second));
    parsedDate.setHours(parsedDate.getHours() - utcOffset);

    return parsedDate;
  }

  return null; // Parsing failed
}

function stringToDate(dateString){
    const [datePart, timePart] = dateString.split(" ");

    const [year, month, day] = datePart.split("-");
    const [hours, minutes] = timePart.split(":");

    const date = new Date(year, month - 1, day, hours, minutes);
    return date;
}

function formatDateToDayMonthYearHourMinute(date) {
    const options = {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
  
    return new Intl.DateTimeFormat("en-GB", options).format(date);
}

async function run(){
    const query = {};
    const allMessages = await executeQuery(query, 'ProgrammedMessages');
    const allBookings = await executeQuery(query, 'Bookings');

    for (let ii = 0; ii < allMessages.length; ii++) {
        const element = allMessages[ii];
        const elementDate = await parseCustomDate(element.date);
        const now = new Date();

        if (elementDate < now){
            console.log(elementDate + ' - ' + now);
            const query3 = { _id: new ObjectId(element.userID) };
            const user = await executeQueryFirst(query3, 'Users');
            const phone = user.phones[0];
            const thisLang = user.language;

            await sendByIntent(element.type, phone,thisLang, elementDate);
            await executeDelete(element, 'ProgrammedMessages');
        }
    }

    for (let jj = 0; jj < allBookings.length; jj++) {
        const element = allBookings[jj];
        let elementDate = stringToDate(element.returnDate);
        elementDate.setTime( elementDate.getTime() + 1 * 86400000 );
        const now = new Date();
        

        if (elementDate < now){
            const bookingID = element._id;
            const query = { _id: new ObjectId(bookingID) };
            await executeDelete(query, 'Bookings');
        }
    }
}

run();