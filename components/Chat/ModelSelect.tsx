import { IconExternalLink } from '@tabler/icons-react';
import { useContext, useEffect, useState } from 'react';
import { parseMutationArgs } from 'react-query/types/core/utils';

import { useTranslation } from 'next-i18next';

import { OpenAIModel } from '@/types/openai';

import HomeContext from '@/pages/api/home/home.context';

export const ModelSelect = () => {
  const { t } = useTranslation('chat');

  const [maxDocs, setMaxDocs] = useState<number>(10);

  let backupChannels = [
    'LBEAT',
    'Compound',
    'AaveCommunity',
    'graphprotocol',
    'Blockswap',
    'CurveFinance',
    'erigon',
    'Lido',
    'EthRD',
    'Arbitrum',
    'Uniswap',
    'RocketPool',
    'Flashbots',
    'LayerZeroOfficial',
    'CryptoDevHub',
    'Secureum',
    'Optimism',
  ];

  let savedChannels = localStorage.getItem('savedChannels')
    ? JSON.parse(localStorage.getItem('savedChannels') as string)
    : [];

  let initialChannels = backupChannels.map((channel) => ({
    channel,
    checked: savedChannels.includes(channel),
  }));

  const [channels, setChannels] = useState(initialChannels);

  const handleChannelChange = (channelName: string) => {
    setChannels((prevChannels) => {
      const updatedChannels = prevChannels.map((channel) =>
        channel.channel === channelName
          ? { ...channel, checked: !channel.checked }
          : channel,
      );

      const checkedChannels = updatedChannels
        .filter((channelObj) => channelObj.checked)
        .map((channelObj) => channelObj.channel);
      localStorage.setItem('savedChannels', JSON.stringify(checkedChannels));

      return updatedChannels;
    });
  };

  useEffect(() => {
    let _maxDocs = parseInt(localStorage.getItem('maxDocs') || '10');
    setMaxDocs(_maxDocs);
  }, [maxDocs]);

  const {
    state: { selectedConversation, models, defaultModelId },
    handleUpdateConversation,
    dispatch: homeDispatch,
  } = useContext(HomeContext);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    selectedConversation &&
      handleUpdateConversation(selectedConversation, {
        key: 'model',
        value: models.find(
          (model) => model.id === e.target.value,
        ) as OpenAIModel,
      });
  };

  return (
    <div className="flex flex-col">
      <label className="mb-2 text-left text-neutral-700 dark:text-neutral-400">
        {t('Model')}
      </label>
      <div className="w-full rounded-lg border border-neutral-200 bg-transparent pr-2 text-neutral-900 dark:border-neutral-600 dark:text-white">
        <select
          className="w-full bg-transparent p-2"
          placeholder={t('Select a model') || ''}
          value={selectedConversation?.model?.id || defaultModelId}
          onChange={handleChange}
        >
          {models.map((model) => (
            <option
              key={model.id}
              value={model.id}
              className="dark:bg-[#343541] dark:text-white"
            >
              {model.id === defaultModelId
                ? `Default (${model.name})`
                : model.name}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full mt-3 text-left text-neutral-700 dark:text-neutral-400 flex items-center">
        Max Docs in search results: &nbsp;{' '}
        <input
          type="number"
          min="1"
          max="500"
          defaultValue={maxDocs}
          value={maxDocs}
          className="w-18"
          onChange={(e) => {
            setMaxDocs(parseInt(e.target.value));
            localStorage.setItem('maxDocs', e.target.value);
          }}
        />
      </div>

      <div className="my-4">
        {channels.map((channel, index) => (
          <div key={channel.channel}>
            <input
              type="checkbox"
              id={`channel-${index}`} // unique id based on the index
              checked={channel.checked}
              onChange={() => handleChannelChange(channel.channel)}
            />
            <label htmlFor={`channel-${index}`} className="text-black">
              {' '}
              {channel.channel}
            </label>
          </div>
        ))}
      </div>

      <div className="w-full mt-3 text-left text-neutral-700 dark:text-neutral-400 flex items-center">
        <a
          href="https://platform.openai.com/account/usage"
          target="_blank"
          className="flex items-center"
        >
          <IconExternalLink size={18} className={'inline mr-1'} />
          {t('View Account Usage')}
        </a>
      </div>
    </div>
  );
};
