Here are the contents for the file /jsdebug/jsdebug/src/components/ExampleComponent.tsx:

import React from 'react';

interface ExampleComponentProps {
    title: string;
    description?: string;
}

const ExampleComponent: React.FC<ExampleComponentProps> = ({ title, description }) => {
    return (
        <div>
            <h1>{title}</h1>
            {description && <p>{description}</p>}
        </div>
    );
};

export default ExampleComponent;