class StateMachine {
    constructor() {
        this.state = 'initial'; // starting state
        this.menuOptions = ['Start', 'Help', 'Contact'];
        this.modality = null; // could be text, voice, etc.
    }

    processMessage(message) {
        switch (this.state) {
            case 'initial':
                this.handleInitialState(message);
                break;
            case 'menu':
                this.handleMenu(message);
                break;
            case 'modalitySelection':
                this.handleModalitySelection(message);
                break;
            case 'fallback':
                this.handleFallback(message);
                break;
            case 'handoff':
                this.handleHandoff(message);
                break;
            default:
                this.state = 'fallback';
                this.handleFallback(message);
                break;
        }
    }

    handleInitialState(message) {
        if (message.text === 'Start') {
            this.state = 'menu';
            this.sendMenu();
        } else {
            this.state = 'fallback';
            this.handleFallback(message);
        }
    }

    sendMenu() {
        // code to send menu to user
        console.log('Menu options:', this.menuOptions);
    }

    handleMenu(message) {
        if (this.menuOptions.includes(message.text)) {
            switch (message.text) {
                case 'Help':
                    this.state = 'fallback';
                    this.handleFallback(message);
                    break;
                case 'Contact':
                    this.state = 'handoff';
                    this.handleHandoff(message);
                    break;
                default:
                    this.state = 'modalitySelection';
                    this.handleModalitySelection(message);
                    break;
            }
        } else {
            this.state = 'fallback';
            this.handleFallback(message);
        }
    }

    handleModalitySelection(message) {
        this.modality = message.text;
        console.log('Modality selected:', this.modality);
        // onward processing based on modality
    }

    handleFallback(message) {
        console.log('Fallback handling for message:', message.text);
        // provide fallback response to user
    }

    handleHandoff(message) {
        console.log('Handoff to human agent for message:', message.text);
        // implement handoff logic
    }
}

// Usage example:
const stateMachine = new StateMachine();
stateMachine.processMessage({ text: 'Start' }); // Initializes the state machine
