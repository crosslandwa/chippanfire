<?php

class Documentation {
    private $_filename;

    public function __construct($filename) {
        $this->_filename = $filename;
    }

    public function __toString() {
        return '<form action="http://www.chippanfire.com/cpf_media/software/' . $this->_filename . '" method="GET">'
            . '<button type="submit" class="btn btn-success">Download Documentation</button>'
            . '</form>';
    }

}
