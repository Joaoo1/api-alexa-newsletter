import Imap from 'imap';
import { MailParser } from 'mailparser';

import StoreNewsLetterService from '../services/StoreNewsLetterService';
import { getNews, getNewsletterDate } from '../utils/emailBody';
import mailConfig from '../../config/mail';
import logger from '../utils/Logger';

function processMessage(msg) {
  const parser = new MailParser();
  parser.on('data', (data) => {
    if (data.type === 'text') {
      const news = getNews(data.text);
      const date = getNewsletterDate(data.text);
      StoreNewsLetterService.run(news, date);
    }
  });

  msg.on('body', (stream) => {
    stream.on('data', (chunk) => {
      parser.write(chunk.toString('utf8'));
    });
  });

  msg.once('end', () => {
    parser.end();
  });
}

function initNewImapInstance() {
  const imap = new Imap(mailConfig);

  function openInbox(cb) {
    imap.openBox('INBOX', false, cb);
  }

  function checkNewEmails() {
    imap.seq.search([['FROM', 'newsletter@filipedeschamps.com.br'], 'UNSEEN'], (err, uuids) => {
      if (err) {
        logger.error(err);
        return;
      }

      if (uuids) {
        uuids.forEach((uuid) => {
          const f = imap.seq.fetch(uuid, {
            markSeen: true,
            bodies: ['HEADER.FIELDS (FROM DATE)', 'TEXT'],
          });

          f.on('message', processMessage);
        });
      }
    });
  }

  imap.once('ready', () => {
    openInbox((err) => {
      if (err) throw err;
    });
  });

  imap.on('mail', checkNewEmails);

  imap.on('error', (err) => {
    logger.error(err);
    imap.destroy();
    initNewImapInstance();
  });

  imap.connect();
}

initNewImapInstance();
